import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categorie = searchParams.get("categorie");

    if (!categorie) {
      return NextResponse.json(
        { success: false, error: "Categorie ontbreekt" },
        { status: 400 }
      );
    }

    const receptenResult = await query(
      `
      SELECT
        id,
        categorie,
        naam,
        hoeveelheid_mix,
        maakinstructie
      FROM keuken_recepten
      WHERE actief = true
        AND categorie = $1
      ORDER BY naam ASC
      `,
      [categorie]
    );

    const recepten = receptenResult.rows;

    // 🔥 ingrediënten per recept ophalen
    for (const recept of recepten) {
      const ingrediëntenResult = await query(
        `
        SELECT naam, gewicht
        FROM keuken_recept_ingredienten
        WHERE recept_id = $1
        ORDER BY volgorde ASC
        `,
        [recept.id]
      );

      recept.ingredienten = ingrediëntenResult.rows;
    }

    return NextResponse.json({
      success: true,
      recepten,
    });
  } catch (error) {
    console.error("API /api/keuken/recepturen fout:", error);

    return NextResponse.json(
      { success: false, error: "Fout bij ophalen recepturen" },
      { status: 500 }
    );
  }
}