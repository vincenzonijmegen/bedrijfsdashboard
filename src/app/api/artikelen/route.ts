// src/app/api/voorraad/artikelen/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const rows = await sql/*sql*/ `
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
      ORDER BY l.naam, p.volgorde;
    `;

    return NextResponse.json(rows);
  } catch (err) {
    console.error("Fout bij ophalen producten:", err);
    return new NextResponse("Databasefout", { status: 500 });
  }
}
