import { NextResponse } from "next/server";
import { query } from "@/lib/db";

type MaaklijstItemRow = {
  id: number;
  categorie: string;
  naam: string;
  maakvolgorde: number;
};

export async function GET() {
  try {
    const result = await query<MaaklijstItemRow>(
      `
      SELECT id, categorie, naam, maakvolgorde
      FROM keuken_recepten
      WHERE actief = true
      ORDER BY
        CASE categorie
          WHEN 'melksmaken' THEN 1
          WHEN 'vruchtensmaken' THEN 2
          WHEN 'suikervrij' THEN 3
          WHEN 'sauzen' THEN 4
          ELSE 99
        END,
        naam ASC
      `
    );

    return NextResponse.json({
      success: true,
      items: result.rows,
    });
  } catch (error) {
    console.error("GET /api/keuken/maaklijst-items fout:", error);
    return NextResponse.json(
      { success: false, error: "Fout bij ophalen maaklijst-items" },
      { status: 500 }
    );
  }
}