import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function parseNumber(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} is ongeldig`);
  return round2(number);
}

function parseDate(value: unknown) {
  const date = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Peildatum moet YYYY-MM-DD zijn");
  }

  const [year, month, day] = date.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  if (
    !Number.isInteger(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > lastDay
  ) {
    throw new Error("Peildatum is ongeldig");
  }

  if (day !== lastDay) {
    throw new Error("Peildatum moet een maandultimo zijn");
  }

  return date;
}

async function getData() {
  const [entities, accounts, freeRoom, snapshots] = await Promise.all([
    db.query(`
      SELECT id, naam, type
      FROM cashflow_entiteiten
      WHERE actief = true
      ORDER BY CASE type WHEN 'werkmaatschappij' THEN 1 ELSE 2 END, naam
    `),
    db.query(`
      SELECT
        r.id,
        r.entiteit_id,
        r.naam,
        r.rekening_type,
        r.prognose_startsaldo,
        to_char(r.saldo_peildatum, 'YYYY-MM-DD') AS saldo_peildatum
      FROM cashflow_rekeningen r
      JOIN cashflow_entiteiten e ON e.id = r.entiteit_id
      WHERE r.actief = true
        AND e.actief = true
      ORDER BY r.entiteit_id, r.naam
    `),
    db.query(`
      SELECT
        entiteit_id,
        oorspronkelijke_creditering,
        reeds_opgenomen,
        to_char(peildatum, 'YYYY-MM-DD') AS peildatum
      FROM cashflow_vrije_ruimte
    `),
    db.query(`
      SELECT
        s.id,
        s.entiteit_id,
        e.naam AS entiteit,
        to_char(s.peildatum, 'YYYY-MM-DD') AS peildatum,
        s.totaal_saldo,
        s.vrije_ruimte_restsaldo,
        s.bron,
        s.toelichting,
        to_char(s.aangemaakt_op, 'YYYY-MM-DD HH24:MI') AS aangemaakt_op,
        COALESCE(
          json_agg(
            json_build_object(
              'accountId', sr.rekening_id,
              'accountName', r.naam,
              'accountType', r.rekening_type,
              'balance', sr.saldo
            )
            ORDER BY r.naam
          ) FILTER (WHERE sr.rekening_id IS NOT NULL),
          '[]'::json
        ) AS rekeningen
      FROM cashflow_saldo_snapshots s
      JOIN cashflow_entiteiten e
        ON e.id = s.entiteit_id
      LEFT JOIN cashflow_saldo_snapshot_rekeningen sr
        ON sr.snapshot_id = s.id
      LEFT JOIN cashflow_rekeningen r
        ON r.id = sr.rekening_id
      GROUP BY s.id, e.naam
      ORDER BY s.entiteit_id, s.peildatum DESC, s.id DESC
    `),
  ]);

  const accountRows = accounts.rows ?? [];
  const freeMap = new Map(
    (freeRoom.rows ?? []).map((row) => [
      Number(row.entiteit_id),
      {
        originalCrediting: Number(row.oorspronkelijke_creditering),
        alreadyWithdrawn: Number(row.reeds_opgenomen),
        remaining: round2(
          Number(row.oorspronkelijke_creditering) -
            Number(row.reeds_opgenomen)
        ),
        balanceDate: String(row.peildatum),
      },
    ])
  );

  const entityData = (entities.rows ?? []).map((entity) => {
    const entityId = Number(entity.id);
    const rows = accountRows.filter(
      (row) => Number(row.entiteit_id) === entityId
    );

    const dates = [...new Set(
      rows
        .map((row) => row.saldo_peildatum && String(row.saldo_peildatum))
        .filter(Boolean)
    )];

    const complete = rows.every(
      (row) =>
        row.prognose_startsaldo !== null &&
        row.saldo_peildatum !== null
    );

    const total = complete
      ? round2(
          rows.reduce(
            (sum, row) => sum + Number(row.prognose_startsaldo),
            0
          )
        )
      : null;

    return {
      id: entityId,
      name: String(entity.naam),
      type: String(entity.type),
      currentDate: dates.length === 1 ? dates[0] : null,
      currentTotal: total,
      accounts: rows.map((row) => ({
        id: Number(row.id),
        name: String(row.naam),
        type: String(row.rekening_type),
        balance:
          row.prognose_startsaldo === null
            ? null
            : Number(row.prognose_startsaldo),
        balanceDate:
          row.saldo_peildatum === null
            ? null
            : String(row.saldo_peildatum),
      })),
      freeRoom: freeMap.get(entityId) ?? null,
    };
  });

  return {
    entities: entityData,
    history: (snapshots.rows ?? []).map((row) => ({
      id: Number(row.id),
      entityId: Number(row.entiteit_id),
      entity: String(row.entiteit),
      date: String(row.peildatum),
      total: Number(row.totaal_saldo),
      freeRoomRemaining:
        row.vrije_ruimte_restsaldo === null
          ? null
          : Number(row.vrije_ruimte_restsaldo),
      source: String(row.bron),
      note: row.toelichting == null ? null : String(row.toelichting),
      createdAt: String(row.aangemaakt_op),
      accounts: Array.isArray(row.rekeningen) ? row.rekeningen : [],
    })),
  };
}

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      fase: "4L-B2",
      data: await getData(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, fase: "4L-B2", error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const client = await db.getClient();

  try {
    const body = await req.json();
    const entityId = Number(body?.entiteit_id);
    const dryRun = body?.dry_run === true;
    const balanceDate = parseDate(body?.peildatum);
    const note = String(body?.toelichting ?? "").trim() || null;

    if (!Number.isInteger(entityId)) {
      throw new Error("Entiteit is verplicht");
    }

    const inputAccounts = Array.isArray(body?.rekeningen)
      ? body.rekeningen
      : [];

    await client.query("BEGIN");

    const currentDateRes = await client.query(
      `SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS current_date`
    );
    const currentDate = String(currentDateRes.rows[0].current_date);

    if (!dryRun && balanceDate > currentDate) {
      throw new Error(
        `Peildatum ${balanceDate} ligt in de toekomst; een echte stand kan pas op of na die datum worden geactiveerd`
      );
    }

    const entityRes = await client.query(`
      SELECT id, naam, type
      FROM cashflow_entiteiten
      WHERE id=$1 AND actief=true
      LIMIT 1
      FOR UPDATE
    `, [entityId]);

    const entity = entityRes.rows[0];
    if (!entity) throw new Error("Onbekende of inactieve entiteit");

    const accountRes = await client.query(`
      SELECT
        id,
        naam,
        rekening_type,
        prognose_startsaldo,
        to_char(saldo_peildatum, 'YYYY-MM-DD') AS saldo_peildatum
      FROM cashflow_rekeningen
      WHERE entiteit_id=$1
        AND actief=true
      ORDER BY id
      FOR UPDATE
    `, [entityId]);

    if (!accountRes.rowCount) {
      throw new Error("Deze entiteit heeft geen actieve rekeningen");
    }

    const currentDates = [...new Set(
      accountRes.rows
        .map((row) => row.saldo_peildatum && String(row.saldo_peildatum))
        .filter(Boolean)
    )];

    if (currentDates.length !== 1) {
      throw new Error(
        "De actieve rekeningen hebben geen gezamenlijke huidige peildatum"
      );
    }

    const currentBalanceDate = currentDates[0];

    if (balanceDate <= currentBalanceDate) {
      throw new Error(
        `Nieuwe peildatum moet na de huidige peildatum ${currentBalanceDate} liggen`
      );
    }

    const expectedIds = accountRes.rows.map((row) => Number(row.id)).sort();
    const supplied = inputAccounts.map((row: any) => ({
      accountId: Number(row?.rekening_id),
      balance: parseNumber(row?.saldo, "Rekeningsaldo"),
    }));

    const suppliedIds = supplied
      .map((row) => row.accountId)
      .filter(Number.isInteger)
      .sort((a, b) => a - b);

    if (
      supplied.length !== expectedIds.length ||
      suppliedIds.length !== expectedIds.length ||
      suppliedIds.some((id, index) => id !== expectedIds[index])
    ) {
      throw new Error(
        "Voor iedere actieve rekening moet exact één saldo worden opgegeven"
      );
    }

    const total = round2(
      supplied.reduce((sum, row) => sum + row.balance, 0)
    );

    const freeRoomRes = await client.query(`
      SELECT
        oorspronkelijke_creditering,
        reeds_opgenomen,
        to_char(peildatum, 'YYYY-MM-DD') AS peildatum
      FROM cashflow_vrije_ruimte
      WHERE entiteit_id=$1
      LIMIT 1
      FOR UPDATE
    `, [entityId]);

    let freeRoomRemaining: number | null = null;

    if (freeRoomRes.rowCount) {
      const original = Number(
        freeRoomRes.rows[0].oorspronkelijke_creditering
      );

      freeRoomRemaining = parseNumber(
        body?.vrije_ruimte_restsaldo,
        "Resterende vrije ruimte"
      );

      if (freeRoomRemaining < 0 || freeRoomRemaining > original) {
        throw new Error(
          `Resterende vrije ruimte moet tussen €0 en €${original.toFixed(2)} liggen`
        );
      }
    }

    const duplicate = await client.query(`
      SELECT id
      FROM cashflow_saldo_snapshots
      WHERE entiteit_id=$1
        AND peildatum=$2::date
      LIMIT 1
    `, [entityId, balanceDate]);

    if (duplicate.rowCount) {
      throw new Error(
        `Voor ${balanceDate} bestaat al een snapshot van deze entiteit`
      );
    }

    const snapshotRes = await client.query(`
      INSERT INTO cashflow_saldo_snapshots (
        entiteit_id,
        peildatum,
        totaal_saldo,
        vrije_ruimte_restsaldo,
        bron,
        toelichting
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id
    `, [
      entityId,
      balanceDate,
      total,
      freeRoomRemaining,
      dryRun ? "controle_zonder_opslaan" : "handmatig",
      note,
    ]);

    const snapshotId = Number(snapshotRes.rows[0].id);

    for (const account of supplied) {
      await client.query(`
        INSERT INTO cashflow_saldo_snapshot_rekeningen (
          snapshot_id,
          rekening_id,
          saldo
        )
        VALUES ($1,$2,$3)
      `, [snapshotId, account.accountId, account.balance]);

      await client.query(`
        UPDATE cashflow_rekeningen
        SET prognose_startsaldo=$3,
            saldo_peildatum=$4::date,
            bijgewerkt_op=now()
        WHERE id=$2
          AND entiteit_id=$1
      `, [entityId, account.accountId, account.balance, balanceDate]);
    }

    if (freeRoomRes.rowCount && freeRoomRemaining !== null) {
      const original = Number(
        freeRoomRes.rows[0].oorspronkelijke_creditering
      );
      const alreadyWithdrawn = round2(original - freeRoomRemaining);

      await client.query(`
        UPDATE cashflow_vrije_ruimte
        SET reeds_opgenomen=$2,
            peildatum=$3::date,
            bijgewerkt_op=now()
        WHERE entiteit_id=$1
      `, [entityId, alreadyWithdrawn, balanceDate]);
    }

    if (dryRun) {
      await client.query("ROLLBACK");
      return NextResponse.json({
        success: true,
        fase: "4L-B2",
        dryRun: true,
        checked: {
          entityId,
          entity: String(entity.naam),
          previousDate: currentBalanceDate,
          newDate: balanceDate,
          total,
          freeRoomRemaining,
          accountCount: supplied.length,
        },
      });
    }

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      fase: "4L-B2",
      dryRun: false,
      saved: {
        snapshotId,
        entityId,
        entity: String(entity.naam),
        previousDate: currentBalanceDate,
        newDate: balanceDate,
        total,
        freeRoomRemaining,
        accountCount: supplied.length,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // niets meer te rollen
    }

    return NextResponse.json(
      { success: false, fase: "4L-B2", error: String(error) },
      { status: 400 }
    );
  } finally {
    client.release();
  }
}
