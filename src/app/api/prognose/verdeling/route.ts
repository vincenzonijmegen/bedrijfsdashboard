import { NextResponse } from "next/server";
import { dbRapportage as db } from "@/lib/dbRapportage";
import { getPrognoseVerdeling } from "@/lib/prognose/getPrognoseVerdeling";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const huidigJaar = new Date().getFullYear();
    const doelJaar = Number(url.searchParams.get("jaar") ?? huidigJaar);

    const model = await getPrognoseVerdeling(doelJaar);

    const vorigJaar = doelJaar - 1;
    const totaalVorigJaar = await db.query(
      `SELECT COALESCE(SUM(aantal * eenheidsprijs), 0) AS totaal
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
