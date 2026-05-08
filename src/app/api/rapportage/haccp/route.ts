import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const datum = req.nextUrl.searchParams.get("datum");
    const routineId = req.nextUrl.searchParams.get("routineId");

    const gekozenDatum =
      datum && /^\d{4}-\d{2}-\d{2}$/.test(datum)
        ? datum
        : new Date().toISOString().slice(0, 10);

    const params: Array<string | number> = [gekozenDatum];
    let routineFilterSql = "";

    if (routineId && routineId !== "all") {
      params.push(Number(routineId));
      routineFilterSql = `AND r.id = $2`;
    }

    const result = await db.query(
      `
      SELECT
        r.id AS routine_id,
        r.naam AS routine_naam,
        r.slug AS routine_slug,
        r.locatie,
        r.type,
        t.id AS taak_id,
        t.naam AS taak_naam,
        COALESCE(t.sortering, 9999) AS sortering,
        CASE
          WHEN a.id IS NOT NULL THEN true
          ELSE false
        END AS afgehandeld,
        a.afgetekend_door_naam AS medewerker_naam,
        a.afgetekend_op
      FROM routines r
      INNER JOIN routine_taken t
  ON t.routine_id = r.id
 AND COALESCE(t.actief, true) = true
 AND (
   t.frequentie = 'D'
OR (
  t.frequentie = 'W'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(t.weekdagen::jsonb) AS wd(dag)
    WHERE wd.dag = CASE EXTRACT(ISODOW FROM $1::date)
      WHEN 1 THEN 'ma'
      WHEN 2 THEN 'di'
      WHEN 3 THEN 'wo'
      WHEN 4 THEN 'do'
      WHEN 5 THEN 'vr'
      WHEN 6 THEN 'za'
      WHEN 7 THEN 'zo'
    END
  )
)
   OR (
     t.frequentie = '2D'
     AND MOD(($1::date - DATE '2026-01-05')::int, 2) = 0
   )
 )
      LEFT JOIN routine_aftekeningen a
        ON a.routine_taak_id = t.id
       AND a.datum = $1::date
      WHERE COALESCE(r.actief, true) = true
        ${routineFilterSql}
      ORDER BY
        r.locatie ASC,
        r.type ASC,
        r.naam ASC,
        COALESCE(t.sortering, 9999) ASC,
        t.naam ASC
      `,
      params
    );

    const routinesMap = new Map<
      number,
      {
        routineId: number;
        routineNaam: string;
        routineSlug: string | null;
        locatie: string | null;
        type: string | null;
        totaal: number;
        afgehandeld: number;
        onderdelen: {
          taakId: number;
          taakNaam: string;
          sortering: number;
          afgehandeld: boolean;
          medewerkerNaam: string | null;
          afgetekendOp: string | null;
        }[];
      }
    >();

    for (const row of result.rows) {
      if (!routinesMap.has(row.routine_id)) {
        routinesMap.set(row.routine_id, {
          routineId: row.routine_id,
          routineNaam: row.routine_naam,
          routineSlug: row.routine_slug,
          locatie: row.locatie,
          type: row.type,
          totaal: 0,
          afgehandeld: 0,
          onderdelen: [],
        });
      }

      const routine = routinesMap.get(row.routine_id)!;

      routine.totaal += 1;
      if (row.afgehandeld) routine.afgehandeld += 1;

      routine.onderdelen.push({
        taakId: row.taak_id,
        taakNaam: row.taak_naam,
        sortering: row.sortering,
        afgehandeld: row.afgehandeld,
        medewerkerNaam: row.medewerker_naam,
        afgetekendOp: row.afgetekend_op,
      });
    }

    const routines = Array.from(routinesMap.values());

    const filterResult = await db.query(
      `
      SELECT id, naam
      FROM routines
      WHERE COALESCE(actief, true) = true
      ORDER BY locatie ASC, type ASC, naam ASC
      `
    );
        const periodiekResult = await db.query(
      `
      WITH periodieke_taken AS (
        SELECT
          r.id AS routine_id,
          r.naam AS routine_naam,
          r.locatie,
          r.type,
          t.id AS taak_id,
          t.naam AS taak_naam,
          t.frequentie,
          CASE t.frequentie
            WHEN 'M' THEN INTERVAL '1 month'
            WHEN 'Q' THEN INTERVAL '3 months'
            WHEN 'H' THEN INTERVAL '6 months'
            WHEN 'Y' THEN INTERVAL '1 year'
          END AS interval_waarde
        FROM routines r
        JOIN routine_taken t
          ON t.routine_id = r.id
         AND COALESCE(t.actief, true) = true
         AND t.frequentie IN ('M', 'Q', 'H', 'Y')
        WHERE COALESCE(r.actief, true) = true
          ${routineFilterSql}
      ),
      laatste AS (
        SELECT DISTINCT ON (a.routine_taak_id)
          a.routine_taak_id,
          a.datum AS laatst_uitgevoerd,
          a.afgetekend_op,
          a.afgetekend_door_naam
        FROM routine_aftekeningen a
        WHERE a.status = 'gedaan'
          AND a.afgetekend_op IS NOT NULL
          AND a.datum <= $1::date
        ORDER BY a.routine_taak_id, a.datum DESC, a.afgetekend_op DESC
      ),
      vandaag AS (
        SELECT
          a.routine_taak_id,
          a.datum,
          a.afgetekend_op,
          a.afgetekend_door_naam
        FROM routine_aftekeningen a
        WHERE a.status = 'gedaan'
          AND a.afgetekend_op IS NOT NULL
          AND a.datum = $1::date
      )
      SELECT
        p.routine_id,
        p.routine_naam,
        p.locatie,
        p.type,
        p.taak_id,
        p.taak_naam,
        p.frequentie,
        l.laatst_uitgevoerd,
        l.afgetekend_op AS laatst_afgetekend_op,
        l.afgetekend_door_naam AS laatst_afgetekend_door_naam,
        CASE
          WHEN l.laatst_uitgevoerd IS NULL THEN NULL
          ELSE (l.laatst_uitgevoerd + p.interval_waarde)::date
        END AS volgende_voor,
        CASE
          WHEN v.routine_taak_id IS NOT NULL THEN true
          ELSE false
        END AS uitgevoerd_op_datum,
        v.afgetekend_door_naam AS uitgevoerd_op_datum_door,
        v.afgetekend_op AS uitgevoerd_op_datum_op,
        CASE
          WHEN l.laatst_uitgevoerd IS NULL THEN NULL
          WHEN (l.laatst_uitgevoerd + p.interval_waarde)::date < $1::date
            THEN ($1::date - (l.laatst_uitgevoerd + p.interval_waarde)::date)::int
          ELSE 0
        END AS dagen_te_laat
      FROM periodieke_taken p
      LEFT JOIN laatste l
        ON l.routine_taak_id = p.taak_id
      LEFT JOIN vandaag v
        ON v.routine_taak_id = p.taak_id
      ORDER BY
        p.locatie ASC,
        p.type ASC,
        p.routine_naam ASC,
        p.taak_naam ASC
      `,
      params
    );

    const periodiekeTaken = periodiekResult.rows.map((row) => ({
      routineId: row.routine_id,
      routineNaam: row.routine_naam,
      locatie: row.locatie,
      type: row.type,
      taakId: row.taak_id,
      taakNaam: row.taak_naam,
      frequentie: row.frequentie,
      laatstUitgevoerd: row.laatst_uitgevoerd,
      laatstAfgetekendOp: row.laatst_afgetekend_op,
      laatstAfgetekendDoor: row.laatst_afgetekend_door_naam,
      volgendeVoor: row.volgende_voor,
      uitgevoerdOpDatum: row.uitgevoerd_op_datum,
      uitgevoerdOpDatumDoor: row.uitgevoerd_op_datum_door,
      uitgevoerdOpDatumOp: row.uitgevoerd_op_datum_op,
      dagenTeLaat:
        row.dagen_te_laat === null ? null : Number(row.dagen_te_laat),
    }));


        return NextResponse.json({
      success: true,
      datum: gekozenDatum,
      filters: filterResult.rows.map((row) => ({
        id: row.id,
        naam: row.naam,
      })),
      routines,
      periodiekeTaken,
    });
  } catch (error) {
    console.error("Fout bij ophalen HACCP-rapportage:", error);
    return NextResponse.json(
      { success: false, error: "Fout bij ophalen HACCP-rapportage" },
      { status: 500 }
    );
  }
}