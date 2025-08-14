// src/app/api/rapportage/maandomzet/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { startTimer } from "@/lib/timing";
import { dbRapportage } from "@/lib/dbRapportage";
import { NextResponse } from "next/server";

type Row = { jaar: number; maand_start: string; totaal: number };
type Payload = { rows: Row[]; max_datum: string | null };

export async function GET() {
  const tAll = startTimer("/api/rapportage/maandomzet");
  try {
    // 1) Snel pad via MV — zorg dat 'rows' NOOIT null is
    const t1 = startTimer("maandomzet:singlecall:mv");
    const { rows } = await dbRapportage.query(`
      WITH mv AS (
        SELECT 
          jaar,
          -- geef maand_start als ISO string 'YYYY-MM-01' voor voorspelbaar client-parsen
          to_char(maand_start, 'YYYY-MM-01') AS maand_start,
          totaal
        FROM rapportage.omzet_maand
        ORDER BY maand_start
      ),
      last AS (
        SELECT MAX(datum) AS max_datum
        FROM rapportage.omzet
      )
      SELECT 
        COALESCE( (SELECT json_agg(mv) FROM mv), '[]'::json ) AS rows,
        (SELECT max_datum FROM last)                         AS max_datum
    `);
    t1.end();

    const payload: Payload = {
      rows: (rows[0]?.rows as Row[]) ?? [],
      max_datum: (rows[0]?.max_datum as string) ?? null,
    };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=60" },
    });

  } catch (mvErr) {
    // 2) Fallback aggregatie (traag, maar altijd werkend)
    console.error("MV pad faalde, fallback aggregatie:", mvErr);
    try {
      const t2 = startTimer("maandomzet:fallback:agg");
      const agg = await dbRapportage.query(`
        WITH per_maand AS (
          SELECT DATE_TRUNC('month', datum) AS maand_start,
                 SUM(aantal * eenheidsprijs) AS som
          FROM rapportage.omzet
          GROUP BY 1
        )
        SELECT 
          EXTRACT(YEAR FROM maand_start)::int AS jaar,
          to_char(maand_start, 'YYYY-MM-01')  AS maand_start,
          ROUND(som)::bigint                  AS totaal
        FROM per_maand
        ORDER BY maand_start
      `);
      t2.end();

      const t3 = startTimer("maandomzet:fallback:maxdatum");
      const maxDatum = await dbRapportage.query(`SELECT MAX(datum) AS max_datum FROM rapportage.omzet`);
      t3.end();

      const payload: Payload = { rows: agg.rows as Row[], max_datum: (maxDatum.rows[0]?.max_datum as string) ?? null };
      return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=30" } });
    } catch (aggErr) {
      console.error("Fallback aggregatie faalde ook:", aggErr);
      const payload: Payload = { rows: [], max_datum: null };
      return NextResponse.json(payload, { status: 200 });
    }
  } finally {
    tAll.end({ hint: "maandomzet" });
  }
}
