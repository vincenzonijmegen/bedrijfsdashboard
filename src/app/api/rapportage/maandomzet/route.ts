// src/app/api/rapportage/maandomzet/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { startTimer } from "@/lib/timing";
import { dbRapportage } from "@/lib/dbRapportage";
import { NextResponse, NextRequest } from "next/server";

type Row = { jaar: number; maand_start: string; totaal: number };
type Payload = { rows: Row[]; max_datum: string | null };

export async function GET(_req: NextRequest) {
  const tAll = startTimer("/api/rapportage/maandomzet");
  try {
    // ⬇️ Altijd de betrouwbare aggregatie uit de brontabel
    const t1 = startTimer("maandomzet:agg");
    const agg = await dbRapportage.query(`
      WITH per_maand AS (
        SELECT date_trunc('month', datum) AS maand_start,
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
    t1.end();

    const t2 = startTimer("maandomzet:maxdatum");
    const maxDatum = await dbRapportage.query(
      `SELECT MAX(datum) AS max_datum FROM rapportage.omzet`
    );
    t2.end();

    const payload: Payload = {
      rows: agg.rows as Row[],
      max_datum: (maxDatum.rows[0]?.max_datum as string) ?? null,
    };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (err) {
    console.error("API maandomzet fout:", err);
    // Laatste vangnet: nooit 500, altijd bruikbare (lege) payload
    const payload: Payload = { rows: [], max_datum: null };
    return NextResponse.json(payload, { status: 200 });
  } finally {
    tAll.end({ hint: "maandomzet" });
  }
}
