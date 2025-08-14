// src/app/api/rapportage/maandomzet/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { startTimer } from "@/lib/timing";
import { dbRapportage } from "@/lib/dbRapportage";
import { NextResponse } from "next/server";

export async function GET() {
  const tAll = startTimer("/api/rapportage/maandomzet");
  try {
    // Lees direct rijen uit de MV (geen json_agg)
    const t1 = startTimer("maandomzet:mv");
    const mvRows = await dbRapportage.query(`
      SELECT
        jaar,
        to_char(maand_start, 'YYYY-MM-01') AS maand_start,
        totaal
      FROM rapportage.omzet_maand
      ORDER BY maand_start
    `);
    t1.end();

    const t2 = startTimer("maandomzet:maxdatum");
    const maxDatum = await dbRapportage.query(`
      SELECT MAX(datum) AS max_datum
      FROM rapportage.omzet
    `);
    t2.end();

    return NextResponse.json({
      rows: mvRows.rows,                          // ← altijd een array
      max_datum: maxDatum.rows[0]?.max_datum ?? null,
    }, {
      headers: { "Cache-Control": "private, max-age=60" }
    });
  } catch (err) {
    console.error("API maandomzet fout:", err);
    return NextResponse.json({ rows: [], max_datum: null }, { status: 500 });
  } finally {
    tAll.end({ hint: "maandomzet" });
  }
}
