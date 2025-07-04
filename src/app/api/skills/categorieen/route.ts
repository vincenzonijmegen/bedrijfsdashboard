// src/app/api/skills/categorieen/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await db.query("SELECT * FROM skill_categorieen ORDER BY volgorde");
    return NextResponse.json(res.rows);
  } catch (err) {
    console.error("GET categorieen error", err);
    return NextResponse.json({ error: "Fout bij ophalen" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { naam, volgorde } = await req.json();
    if (!naam) return NextResponse.json({ error: "Naam is verplicht" }, { status: 400 });

    await db.query(
      "INSERT INTO skill_categorieen (naam, volgorde) VALUES ($1, $2)",
      [naam, volgorde || null]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST categorie error", err);
    return NextResponse.json({ error: "Fout bij toevoegen" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, naam, volgorde } = await req.json();
    if (!id || !naam) return NextResponse.json({ error: "ID en naam verplicht" }, { status: 400 });

    await db.query(
  "UPDATE skill_categorieen SET naam = $1, volgorde = $2 WHERE id = $3",
  [naam, volgorde ?? 0, id]
);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT categorie error", err);
    return NextResponse.json({ error: "Fout bij bijwerken" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "ID ontbreekt" }, { status: 400 });

    const check = await db.query("SELECT COUNT(*) FROM skills WHERE categorie_id = $1", [id]);
    const count = Number(check.rows[0].count);

    if (count > 0) {
      return NextResponse.json({ error: "Categorie wordt nog gebruikt in skills" }, { status: 400 });
    }

    await db.query("DELETE FROM skill_categorieen WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE categorie error", err);
    return NextResponse.json({ error: "Fout bij verwijderen" }, { status: 500 });
  }
}
