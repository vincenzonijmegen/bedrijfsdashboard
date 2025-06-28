// src/app/api/voorraad/artikelen/route.ts
import { pool } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        id,
        naam,
        bestelnummer,
        besteleenheid AS eenheid,
        huidige_prijs AS prijs
      FROM producten
      WHERE actief = true
      ORDER BY volgorde
    `);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Fout bij ophalen artikelen:", error);
    return NextResponse.json({ error: "Kan artikelen niet ophalen" }, { status: 500 });
  }
}
