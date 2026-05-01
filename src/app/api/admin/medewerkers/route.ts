import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { rows } = await db.query(`
      SELECT
        id,
        TRIM(naam) AS naam,
        email,
        functie,
        geboortedatum,
        COALESCE(kan_scheppen, false) AS kan_scheppen,
        COALESCE(kan_voorbereiden, false) AS kan_voorbereiden,
        COALESCE(kan_ijsbereiden, false) AS kan_ijsbereiden
      FROM medewerkers
      ORDER BY naam
    `);

    return NextResponse.json({
      success: true,
      items: rows,
    });
  } catch (error) {
    console.error("Fout bij ophalen medewerkers:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Medewerkers ophalen mislukt",
        items: [],
      },
      { status: 500 }
    );
  }
}