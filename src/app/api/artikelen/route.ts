// src/app/api/voorraad/artikelen/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  const leverancierParam = req.nextUrl.searchParams.get("leverancier");

  try {
    const result = await pool.query(
      `
      SELECT id, naam, bestelnummer, besteleenheid AS eenheid, huidige_prijs AS prijs
      FROM producten
      WHERE actief = true
      ${leverancierParam ? "AND leverancier_id = $1" : ""}
      ORDER BY volgorde
    `,
      leverancierParam ? [parseInt(leverancierParam)] : []
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Fout bij ophalen producten:", error);
    return NextResponse.json(
      { error: "Fout bij ophalen producten" },
      { status: 500 }
    );
  }
}
