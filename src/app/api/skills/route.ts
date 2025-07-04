// src/app/api/skills/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const result = await db.query(`
      SELECT s.id, s.naam, s.categorie_id, s.beschrijving, c.naam AS categorie_naam
      FROM skills s
      LEFT JOIN skill_categorieen c ON s.categorie_id = c.id
      ORDER BY c.naam, s.naam
    `);
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("GET skills error", err);
    return NextResponse.json({ error: "Fout bij ophalen" }, { status: 500 });
  }
}


export async function POST(req: NextRequest) {
  try {
    const { naam, categorie_id, beschrijving } = await req.json();
    if (!naam || !categorie_id) {
      return NextResponse.json({ error: "Naam en categorie zijn verplicht" }, { status: 400 });
    }
    const res = await db.query(
  `INSERT INTO skills (naam, categorie_id, beschrijving, actief) VALUES ($1, $2, $3, true)`,
  [naam, categorie_id, beschrijving || ""]
);
    return NextResponse.json({ success: true, skill: res.rows[0] });
  } catch (err) {
    console.error("POST skills error", err);
    return NextResponse.json({ error: "Fout bij toevoegen" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
   const { id, naam, categorie_id, beschrijving, actief } = await req.json();
    if (!id || !naam || !categorie_id) {
      return NextResponse.json({ error: "ID, naam en categorie zijn verplicht" }, { status: 400 });
    }
    await db.query(
  `UPDATE skills
   SET naam = $1,
       categorie_id = $2,
       beschrijving = $3,
       actief = $4
   WHERE id = $5`,
  [naam, categorie_id, beschrijving || "", actief ?? true, id]
);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT skills error", err);
    return NextResponse.json({ error: "Fout bij bijwerken" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID ontbreekt" }, { status: 400 });
    }

    const check = await db.query(
      "SELECT COUNT(*) FROM skill_toegewezen WHERE skill_id = $1",
      [id]
    );
    const count = Number(check.rows[0].count);

    if (count > 0) {
      return NextResponse.json({ error: "Skill is nog gekoppeld aan medewerkers" }, { status: 400 });
    }

    await db.query("DELETE FROM skills WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE skills error", err);
    return NextResponse.json({ error: "Fout bij verwijderen" }, { status: 500 });
  }
}
