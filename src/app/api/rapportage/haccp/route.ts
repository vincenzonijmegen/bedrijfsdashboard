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
     AND t.weekdagen IS NOT NULL
     AND CASE EXTRACT(ISODOW FROM $1::date)
       WHEN 1 THEN 'ma'
       WHEN 2 THEN 'di'
       WHEN 3 THEN 'wo'
       WHEN 4 THEN 'do'
       WHEN 5 THEN 'vr'
       WHEN 6 THEN 'za'
       WHEN 7 THEN 'zo'
     END = ANY(t.weekdagen)
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

    return NextResponse.json({
      success: true,
      datum: gekozenDatum,
      filters: filterResult.rows.map((row) => ({
        id: row.id,
        naam: row.naam,
      })),
      routines,
    });
  } catch (error) {
    console.error("Fout bij ophalen HACCP-rapportage:", error);
    return NextResponse.json(
      { success: false, error: "Fout bij ophalen HACCP-rapportage" },
      { status: 500 }
    );
  }
}