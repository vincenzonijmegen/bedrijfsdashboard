// src/app/api/skills/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const result = await db.query("SELECT * FROM skills ORDER BY categorie, naam");
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("GET skills error", err);
    return NextResponse.json({ error: "Fout bij ophalen" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { naam, categorie } = await req.json();
    if (!naam || !categorie) {
      return NextResponse.json({ error: "Naam en categorie zijn verplicht" }, { status: 400 });
    }
    await db.query(
      "INSERT INTO skills (naam, categorie, actief) VALUES ($1, $2, true)",
      [naam, categorie]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST skills error", err);
    return NextResponse.json({ error: "Fout bij toevoegen" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, naam, categorie, beschrijving, actief } = await req.json();
    if (!id || !naam || !categorie) {
      return NextResponse.json({ error: "ID, naam en categorie zijn verplicht" }, { status: 400 });
    }
    await db.query(
      "UPDATE skills SET naam = $1, categorie = $2, beschrijving = $3, actief = $4 WHERE id = $5",
      [naam, categorie, beschrijving || "", actief ?? true, id]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT skills error", err);
    return NextResponse.json({ error: "Fout bij bijwerken" }, { status: 500 });
  }
}
