// src/app/api/rapportage/maandomzet/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { startTimer } from "@/lib/timing";
import { dbRapportage } from "@/lib/dbRapportage";
import { NextResponse } from "next/server";

type Payload = { rows: Array<{ jaar: number; maand_start: string; totaal: number }>; max_datum: string | null };

export async function GET() {
  const tAll = startTimer("/api/rapportage/maandomzet");
  try {
    // 1) Probeer snelle route via MV in 1 call
    const t1 = startTimer("maandomzet:singlecall:mv");
    const { rows } = await dbRapportage.query(`
      WITH mv AS (
        SELECT jaar, maand_start, totaal
        FROM rapportage.omzet_maand
        ORDER BY maand_start
      ),
      last AS (
        SELECT MAX(datum) AS max_datum
        FROM rapportage.omzet
      )
      SELECT 
        (SELECT json_agg(row_to_json(mv)) FROM mv) AS rows,
        (SELECT max_datum FROM last)               AS max_datum
    `);
    t1.end();

    const payload: Payload = {
      rows: rows[0]?.rows ?? [],
      max_datum: rows[0]?.max_datum ?? null,
    };

    return new NextResponse(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (mvErr) {
    // 2) Fallback: traag maar altijd werkend
    console.error("MV pad faalde, val terug op aggregatie:", mvErr);
    try {
      const t2 = startTimer("maandomzet:fallback:agg");
      const agg = await dbRapportage.query(`
        WITH per_maand AS (
          SELECT DATE_TRUNC('month', datum) AS maand_start,
                 SUM(aantal * eenheidsprijs) AS som
          FROM rapportage.omzet
          GROUP BY 1
        )
        SELECT EXTRACT(YEAR FROM maand_start)::int AS jaar,
               maand_start,
               ROUND(som)::bigint AS totaal
        FROM per_maand
        ORDER BY maand_start
      `);
      t2.end();

      const t3 = startTimer("maandomzet:fallback:maxdatum");
      const maxDatum = await dbRapportage.query(`SELECT MAX(datum) AS max_datum FROM rapportage.omzet`);
      t3.end();

      const payload: Payload = { rows: agg.rows, max_datum: maxDatum.rows[0]?.max_datum ?? null };

      return NextResponse.json(payload, {
        headers: { "Cache-Control": "private, max-age=30" },
      });
    } catch (aggErr) {
      console.error("Fallback aggregatie faalde ook:", aggErr);
      // 3) Laatste vangnet: 200 + lege data (UI crasht niet)
      const payload: Payload = { rows: [], max_datum: null };
      return NextResponse.json(payload, { status: 200 });
    }
  } finally {
    tAll.end({ hint: "maandomzet" });
  }
}
