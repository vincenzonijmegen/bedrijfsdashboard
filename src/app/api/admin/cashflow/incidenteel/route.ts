import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toNumber(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} is ongeldig`);
  return number;
}

function dateOnly(value: unknown, label: string) {
  const date = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`${label} moet YYYY-MM-DD zijn`);
  }
  return date;
}

function text(value: unknown, label: string, max = 250) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} is verplicht`);
  if (result.length > max) throw new Error(`${label} is te lang`);
  return result;
}

async function entityExists(entityId: number) {
  const res = await db.query(
    `SELECT 1 FROM cashflow_entiteiten WHERE id=$1 AND actief=true`,
    [entityId]
  );
  return Boolean(res.rowCount);
}

async function getData(fromYear: number, toYear: number) {
  const [entities, rows] = await Promise.all([
    db.query(`
      SELECT id, naam, type
      FROM cashflow_entiteiten
      WHERE actief = true
      ORDER BY CASE type WHEN 'werkmaatschappij' THEN 1 ELSE 2 END, naam
    `),
    db.query(`
      SELECT
        i.id,
        i.entiteit_id,
        e.naam AS entiteit,
        e.type AS entiteit_type,
        to_char(i.datum, 'YYYY-MM-DD') AS datum,
        i.omschrijving,
        i.bedrag,
        i.richting,
        i.categorie,
        i.tegenpartij_naam,
        i.btw_percentage,
        i.btw_aftrekbaar_percentage,
        i.bedrag_is_inclusief_btw,
        i.uitstelbaar,
        i.status,
        i.reden,
        to_char(i.betaald_op, 'YYYY-MM-DD') AS betaald_op
      FROM cashflow_incidenteel i
      JOIN cashflow_entiteiten e ON e.id = i.entiteit_id
      WHERE EXTRACT(YEAR FROM i.datum)::int BETWEEN $1 AND $2
        AND i.status <> 'vervallen'
      ORDER BY i.datum DESC, i.id DESC
    `, [fromYear, toYear]),
  ]);

  return {
    entities: entities.rows.map((r) => ({
      id: Number(r.id),
      name: String(r.naam),
      type: String(r.type),
    })),
    items: rows.rows.map((r) => ({
      id: Number(r.id),
      entityId: Number(r.entiteit_id),
      entity: String(r.entiteit),
      entityType: String(r.entiteit_type),
      date: String(r.datum),
      description: String(r.omschrijving),
      amount: Number(r.bedrag),
      direction: r.richting === "in" ? "in" : "uit",
      category: String(r.categorie),
      counterparty:
        r.tegenpartij_naam == null ? null : String(r.tegenpartij_naam),
      vatPct: Number(r.btw_percentage) || 0,
      deductiblePct: Number(r.btw_aftrekbaar_percentage) || 0,
      amountIncludesVat: r.bedrag_is_inclusief_btw !== false,
      postponable: Boolean(r.uitstelbaar),
      status: String(r.status),
      reason: r.reden == null ? null : String(r.reden),
      paidOn: r.betaald_op == null ? null : String(r.betaald_op),
      editable: String(r.status) !== "betaald",
    })),
  };
}

function years(req: NextRequest) {
  const current = new Date().getFullYear();
  const fromYear = Number(req.nextUrl.searchParams.get("van") ?? current);
  const toYear = Number(req.nextUrl.searchParams.get("tot") ?? current + 3);

  if (
    !Number.isInteger(fromYear) ||
    !Number.isInteger(toYear) ||
    fromYear < 2020 ||
    toYear < fromYear ||
    toYear > current + 10
  ) {
    throw new Error("Ongeldige jaarperiode");
  }

  return { fromYear, toYear };
}

export async function GET(req: NextRequest) {
  try {
    const { fromYear, toYear } = years(req);
    return NextResponse.json({
      success: true,
      fase: "4K-B3",
      data: await getData(fromYear, toYear),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, fase: "4K-B3", error: String(error) },
      { status: 400 }
    );
  }
}

function parseBody(body: any) {
  const entityId = Number(body?.entiteit_id);
  if (!Number.isInteger(entityId)) throw new Error("Entiteit is verplicht");

  const date = dateOnly(body?.datum, "Datum");
  const description = text(body?.omschrijving, "Omschrijving", 300);
  const amount = toNumber(body?.bedrag, "Bedrag");
  if (amount <= 0) throw new Error("Bedrag moet groter dan 0 zijn");

  const direction = String(body?.richting);
  if (!["in", "uit"].includes(direction)) {
    throw new Error("Richting moet in of uit zijn");
  }

  const category = text(
    body?.categorie || "overig_incidenteel",
    "Categorie",
    100
  );
  const counterparty = String(body?.tegenpartij_naam ?? "").trim() || null;
  const vatPct = toNumber(body?.btw_percentage ?? 0, "BTW-percentage");
  const deductiblePct =
    direction === "uit"
      ? toNumber(
          body?.btw_aftrekbaar_percentage ?? 0,
          "BTW-aftrekbaar percentage"
        )
      : 0;

  if (vatPct < 0 || vatPct > 100) {
    throw new Error("BTW-percentage moet tussen 0 en 100 liggen");
  }
  if (deductiblePct < 0 || deductiblePct > 100) {
    throw new Error("BTW-aftrekbaar percentage moet tussen 0 en 100 liggen");
  }

  return {
    entityId,
    date,
    description,
    amount,
    direction,
    category,
    counterparty,
    vatPct,
    deductiblePct,
    postponable: Boolean(body?.uitstelbaar),
    reason: String(body?.reden ?? "").trim() || null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const item = parseBody(body);

    if (!(await entityExists(item.entityId))) {
      throw new Error("Onbekende of inactieve entiteit");
    }

    const result = await db.query(`
      INSERT INTO cashflow_incidenteel (
        entiteit_id,
        datum,
        omschrijving,
        bedrag,
        richting,
        categorie,
        tegenpartij_naam,
        btw_percentage,
        btw_aftrekbaar_percentage,
        bedrag_is_inclusief_btw,
        uitstelbaar,
        status,
        reden,
        betaald_op
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        true,$10,'gepland',$11,NULL
      )
      RETURNING id
    `, [
      item.entityId,
      item.date,
      item.description,
      item.amount,
      item.direction,
      item.category,
      item.counterparty,
      item.vatPct,
      item.deductiblePct,
      item.postponable,
      item.reason,
    ]);

    return NextResponse.json({
      success: true,
      fase: "4K-B3",
      saved: { id: Number(result.rows[0].id) },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, fase: "4K-B3", error: String(error) },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = Number(body?.id);
    if (!Number.isInteger(id)) throw new Error("Ongeldige post");

    const item = parseBody(body);
    if (!(await entityExists(item.entityId))) {
      throw new Error("Onbekende of inactieve entiteit");
    }

    const result = await db.query(`
      UPDATE cashflow_incidenteel
      SET entiteit_id=$2,
          datum=$3,
          omschrijving=$4,
          bedrag=$5,
          richting=$6,
          categorie=$7,
          tegenpartij_naam=$8,
          btw_percentage=$9,
          btw_aftrekbaar_percentage=$10,
          bedrag_is_inclusief_btw=true,
          uitstelbaar=$11,
          reden=$12,
          bijgewerkt_op=now()
      WHERE id=$1
        AND status <> 'betaald'
      RETURNING id
    `, [
      id,
      item.entityId,
      item.date,
      item.description,
      item.amount,
      item.direction,
      item.category,
      item.counterparty,
      item.vatPct,
      item.deductiblePct,
      item.postponable,
      item.reason,
    ]);

    if (!result.rowCount) {
      throw new Error("Post niet gevonden of is al betaald en daarom vergrendeld");
    }

    return NextResponse.json({
      success: true,
      fase: "4K-B3",
      saved: { id },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, fase: "4K-B3", error: String(error) },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const id = Number(body?.id);
    if (!Number.isInteger(id)) throw new Error("Ongeldige post");

    const result = await db.query(`
      DELETE FROM cashflow_incidenteel
      WHERE id=$1
        AND status <> 'betaald'
      RETURNING id
    `, [id]);

    if (!result.rowCount) {
      throw new Error(
        "Post niet gevonden of is al betaald en kan niet worden verwijderd"
      );
    }

    return NextResponse.json({
      success: true,
      fase: "4K-B3",
      deleted: { id },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, fase: "4K-B3", error: String(error) },
      { status: 400 }
    );
  }
}
