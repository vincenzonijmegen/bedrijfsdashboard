// src/app/api/leveranciers/route.ts

import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET: alle leveranciers ophalen
export async function GET() {
  try {
    const res = await db.query("SELECT id, naam, soort FROM leveranciers ORDER BY naam");
    return NextResponse.json(res.rows);
  } catch (err) {
    console.error("Fout bij ophalen leveranciers:", err);
    return NextResponse.json({ error: "Databasefout" }, { status: 500 });
  }
}

// POST: nieuwe leverancier toevoegen
export async function POST(req: NextRequest) {
  try {
    const { naam, soort } = await req.json();
    const result = await db.query(
      "INSERT INTO leveranciers (naam, soort) VALUES ($1, $2) RETURNING *",
      [naam, soort]
    );
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("Fout bij toevoegen leverancier:", err);
    return NextResponse.json({ error: "Toevoegen mislukt" }, { status: 500 });
  }
}

// PUT: bestaande leverancier bijwerken
export async function PUT(req: NextRequest) {
  try {
    const { id, naam, soort } = await req.json();
    const result = await db.query(
      "UPDATE leveranciers SET naam = $1, soort = $2 WHERE id = $3 RETURNING *",
      [naam, soort, id]
    );
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("Fout bij bijwerken leverancier:", err);
    return NextResponse.json({ error: "Update mislukt" }, { status: 500 });
  }
}

// DELETE: leverancier verwijderen
export async function DELETE(req: NextRequest) {
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "ID ontbreekt" }, { status: 400 });

    await db.query("DELETE FROM leveranciers WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Fout bij verwijderen leverancier:", err);
    return NextResponse.json({ error: "Verwijderen mislukt" }, { status: 500 });
  }
}
