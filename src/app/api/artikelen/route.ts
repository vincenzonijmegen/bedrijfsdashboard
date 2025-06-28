// src/app/api/voorraad/artikelen/route.ts
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await sql`
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
    ORDER BY l.naam, p.volgorde NULLS LAST;
  `;

  return NextResponse.json(result.rows);
}
