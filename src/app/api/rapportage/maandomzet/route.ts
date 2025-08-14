// src/app/api/rapportage/maandomzet/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { startTimer } from "@/lib/timing";
import { dbRapportage } from "@/lib/dbRapportage";
import { NextResponse } from "next/server";

export async function GET() {
  const tAll = startTimer("/api/rapportage/maandomzet");
  try {
    // ⬇️ Snel: uit de materialized view lezen
    const t1 = startTimer("maandomzet:mv");
    const omzet = await dbRapportage.query(`
      SELECT jaar, maand_start, totaal
      FROM rapportage.omzet_maand
      ORDER BY maand_start
    `);
    t1.end();

    // Alleen voor “laatste import” nog in de brontabel kijken
    const t2 = startTimer("maandomzet:maxdatum");
    const maxDatum = await dbRapportage.query(`
      SELECT MAX(datum) AS max_datum
      FROM rapportage.omzet
    `);
    t2.end();

    return NextResponse.json({
      rows: omzet.rows,
      max_datum: maxDatum.rows[0].max_datum,
    });
  } catch (err) {
    console.error("API maandomzet fout:", err);
    return NextResponse.json({ error: "Fout bij ophalen maandomzet" }, { status: 500 });
  } finally {
    tAll.end({ hint: "maandomzet" });
  }
}
