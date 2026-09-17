import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPrognoseVerdeling } from "@/lib/prognose/getPrognoseVerdeling";

export async function GET() {
  try {
    const model = await getPrognoseVerdeling();

    const vorigJaar = new Date().getFullYear() - 1;
    const totaalVorigJaar = await db.query(
      `SELECT SUM(aantal * eenheidsprijs) AS totaal
       FROM rapportage.omzet
       WHERE EXTRACT(YEAR FROM datum)::int = $1`,
      [vorigJaar]
    );

    const omzetVorigJaar = Number(totaalVorigJaar.rows[0]?.totaal || 0);
    const omzetPrognose = Math.round(omzetVorigJaar * 1.03);

    return NextResponse.json({
      jaren: model.jaren,
      bronJaren: model.bronJaren,
      verdeling: model.verdeling,
      omzetPrognose,
    });
  } catch (error) {
    console.error("Fout bij ophalen maandverdeling:", error);
    return NextResponse.json(
      { error: "Fout bij ophalen maandverdeling" },
      { status: 500 }
    );
  }
}
