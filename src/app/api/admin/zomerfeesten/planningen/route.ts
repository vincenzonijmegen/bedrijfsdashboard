import { db, pool } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SmaakInput = {
  id?: number | null;
  recept_id?: number | null;
  smaakcode?: string | null;
  smaaknaam?: string | null;
  soort?: "melk" | "vrucht" | "overig";
  aantal_bakken?: number | string | null;
  kleur?: string | null;
  sortering?: number | null;
};

const toNumber = (value: unknown, fallback = 0) => {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toText = (value: unknown, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
};

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  try {
    if (id) {
      const planningRes = await db.query(
        `SELECT * FROM zomerfeesten_planningen WHERE id = $1`,
        [id]
      );

      if (planningRes.rowCount === 0) {
        return NextResponse.json({ error: "Planning niet gevonden" }, { status: 404 });
      }

      const smakenRes = await db.query(
        `SELECT
           zsp.id,
           zsp.planning_id,
           zsp.recept_id,
           zsp.smaakcode,
           zsp.smaaknaam,
           zsp.soort,
           zsp.aantal_bakken,
           zsp.kleur,
           zsp.sortering,
           zsp.smaaknaam AS recept_naam,
           rk.kostprijs_recept_id,
           rk.status AS koppeling_status,
           rk.opmerking AS koppeling_opmerking,
           kr.naam AS kostprijs_recept_naam,
           CASE
             WHEN rk.kostprijs_recept_id IS NOT NULL
              AND COALESCE(rk.status, '') NOT IN ('ontbreekt_kostprijs', 'controle_nodig', 'overslaan')
             THEN true
             ELSE false
           END AS doorrekenbaar
         FROM zomerfeesten_smaakplanning zsp
         LEFT JOIN recept_koppelingen rk ON rk.keuken_recept_id = zsp.recept_id
         LEFT JOIN recepten kr ON kr.id = rk.kostprijs_recept_id
         WHERE zsp.planning_id = $1
         ORDER BY zsp.sortering NULLS LAST, zsp.soort, zsp.smaaknaam`,
        [id]
      );

      return NextResponse.json({
        planning: planningRes.rows[0],
        smaken: smakenRes.rows,
      });
    }

    const result = await db.query(`
      SELECT
        zp.*,
        COUNT(zsp.id)::int AS aantal_smaken,
        COALESCE(SUM(zsp.aantal_bakken), 0)::numeric AS totaal_bakken
      FROM zomerfeesten_planningen zp
      LEFT JOIN zomerfeesten_smaakplanning zsp ON zsp.planning_id = zp.id
      GROUP BY zp.id
      ORDER BY zp.jaar DESC
    `);

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Fout bij ophalen Zomerfeestenplanning:", err);
    return NextResponse.json({ error: "Databasefout" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const body = await req.json();
    const id = body.id ? Number(body.id) : null;
    const jaar = toNumber(body.jaar);
    const naam = toText(body.naam, "Zomerfeesten");
    const startDatum = toText(body.start_datum);
    const eindDatum = toText(body.eind_datum);
    const omzetPerDag = toNumber(body.omzet_per_dag);
    const percentageMelk = toNumber(body.percentage_melk, 65);
    const percentageVruchten = toNumber(body.percentage_vruchten, 35);
    const opbrengstPerBakMelk = toNumber(body.opbrengst_per_bak_melk, 90);
    const opbrengstPerBakVrucht = toNumber(body.opbrengst_per_bak_vrucht, 80);
    const aantalMachines = toNumber(body.aantal_machines, 3);
    const kastruimteBakken = toNumber(body.kastruimte_bakken, 50);
    const status = ["concept", "actief", "afgerond"].includes(body.status)
      ? body.status
      : "concept";
    const smaken: SmaakInput[] = Array.isArray(body.smaken) ? body.smaken : [];

    if (!jaar || !startDatum || !eindDatum) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Jaar, startdatum en einddatum zijn verplicht" },
        { status: 400 }
      );
    }

    let planningId = id;

    if (planningId) {
      await client.query(
        `UPDATE zomerfeesten_planningen
         SET jaar = $1,
             naam = $2,
             start_datum = $3,
             eind_datum = $4,
             omzet_per_dag = $5,
             percentage_melk = $6,
             percentage_vruchten = $7,
             opbrengst_per_bak_melk = $8,
             opbrengst_per_bak_vrucht = $9,
             aantal_machines = $10,
             kastruimte_bakken = $11,
             status = $12,
             bijgewerkt_op = now()
         WHERE id = $13`,
        [
          jaar,
          naam,
          startDatum,
          eindDatum,
          omzetPerDag,
          percentageMelk,
          percentageVruchten,
          opbrengstPerBakMelk,
          opbrengstPerBakVrucht,
          aantalMachines,
          kastruimteBakken,
          status,
          planningId,
        ]
      );
    } else {
      const insert = await client.query(
        `INSERT INTO zomerfeesten_planningen
         (jaar, naam, start_datum, eind_datum, omzet_per_dag, percentage_melk, percentage_vruchten, opbrengst_per_bak_melk, opbrengst_per_bak_vrucht, aantal_machines, kastruimte_bakken, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          jaar,
          naam,
          startDatum,
          eindDatum,
          omzetPerDag,
          percentageMelk,
          percentageVruchten,
          opbrengstPerBakMelk,
          opbrengstPerBakVrucht,
          aantalMachines,
          kastruimteBakken,
          status,
        ]
      );
      planningId = insert.rows[0].id;
    }

    await client.query(
      `DELETE FROM zomerfeesten_smaakplanning WHERE planning_id = $1`,
      [planningId]
    );

    for (const [index, smaak] of smaken.entries()) {
      const smaakcode = toText(smaak.smaakcode).toUpperCase();
      const smaaknaam = toText(smaak.smaaknaam);
      const soort = ["melk", "vrucht", "overig"].includes(String(smaak.soort))
        ? String(smaak.soort)
        : "melk";
      const aantalBakken = toNumber(smaak.aantal_bakken);

      if (!smaakcode || !smaaknaam) continue;

      await client.query(
        `INSERT INTO zomerfeesten_smaakplanning
         (planning_id, recept_id, smaakcode, smaaknaam, soort, aantal_bakken, kleur, sortering)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          planningId,
          smaak.recept_id || null,
          smaakcode,
          smaaknaam,
          soort,
          aantalBakken,
          smaak.kleur || null,
          smaak.sortering ?? index + 1,
        ]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({ status: "ok", id: planningId });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Fout bij opslaan Zomerfeestenplanning:", err);

    if (err?.code === "23505") {
      return NextResponse.json(
        { error: "Er bestaat al een Zomerfeestenplanning voor dit jaar" },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id ontbreekt" }, { status: 400 });
  }

  try {
    await db.query(`DELETE FROM zomerfeesten_planningen WHERE id = $1`, [id]);
    return NextResponse.json({ status: "verwijderd" });
  } catch (err) {
    console.error("Fout bij verwijderen Zomerfeestenplanning:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}
