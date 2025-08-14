// src/app/api/rapportage/maandomzet/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { startTimer } from "@/lib/timing";
import { dbRapportage } from "@/lib/dbRapportage";
import { NextResponse } from "next/server";

export async function GET() {
  const timer = startTimer("/api/rapportage/maandomzet");
  try {
    const omzet = await dbRapportage.query(`
      SELECT 
        EXTRACT(YEAR FROM datum) AS jaar,
        DATE_TRUNC('month', datum) AS maand_start,
        ROUND(SUM(aantal * eenheidsprijs)) AS totaal
      FROM rapportage.omzet
      GROUP BY jaar, maand_start
      ORDER BY maand_start
    `);

    const maxDatum = await dbRapportage.query(`
      SELECT MAX(datum) AS max_datum 
      FROM rapportage.omzet
    `);

    return NextResponse.json({
      rows: omzet.rows,
      max_datum: maxDatum.rows[0].max_datum,
    });
  } catch (err) {
    console.error("API maandomzet fout:", err);
    return NextResponse.json(
      { error: "Fout bij ophalen maandomzet" },
      { status: 500 }
    );
  } finally {
    // ⬇️ wordt altijd uitgevoerd, ook bij fouten
    timer.end({ hint: "maandomzet" });
  }
}
