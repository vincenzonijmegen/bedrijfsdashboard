// src/app/api/producten/route.ts

import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leverancier = searchParams.get("leverancier");

  if (!leverancier) {
    return NextResponse.json({ error: "leverancier vereist" }, { status: 400 });
  }

  try {
    const result = await db.query(
      `SELECT id, naam, bestelnummer, minimum_voorraad, besteleenheid, huidige_prijs, actief
         FROM producten
        WHERE leverancier_id = $1
        ORDER BY naam`,
      [leverancier]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Fout bij ophalen producten:", err);
    return NextResponse.json({ error: "Databasefout" }, { status: 500 });
  }
}
