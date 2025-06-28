// src/app/api/voorraad/artikelen/route.ts
import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: true,
});

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.naam,
        p.bestelnummer,
        p.minimum_voorraad,
        p.besteleenheid,
        p.huidige_prijs,
        l.naam AS leverancier
      FROM producten p
      JOIN leveranciers l ON p.leverancier_id = l.id
      WHERE p.actief = true
      ORDER BY l.naam, p.volgorde
    `);

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Fout bij ophalen artikelen:", err);
    return new NextResponse("Databasefout", { status: 500 });
  }
}
