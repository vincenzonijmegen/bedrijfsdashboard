// /app/api/skills/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await db.query(`SELECT id, naam, categorie FROM skills WHERE actief = true ORDER BY categorie, naam`);
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Fout bij ophalen skills:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}"

// /app/api/skills/toegewezen/route.ts
// GET: /api/skills/toegewezen?medewerker_id=123
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const medewerker_id = searchParams.get("medewerker_id");
    if (!medewerker_id) return NextResponse.json([], { status: 400 });

    const result = await db.query(
      `SELECT skill_id, deadline_dagen FROM skill_toegewezen WHERE medewerker_id = $1`,
      [medewerker_id]
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Fout bij ophalen toegewezen skills:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}

// /app/api/skills/toewijzen/route.ts
// POST: body = [{ medewerker_id, skill_id, deadline_dagen }]
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!Array.isArray(body)) return NextResponse.json({ error: "Ongeldige input" }, { status: 400 });

    const { medewerker_id } = body[0] || {};
    if (!medewerker_id) return NextResponse.json({ error: "Geen medewerker_id" }, { status: 400 });

    // alles wissen en dan opnieuw invoegen
    await db.query(`DELETE FROM skill_toegewezen WHERE medewerker_id = $1`, [medewerker_id]);

    for (const { skill_id, deadline_dagen } of body) {
      await db.query(
        `INSERT INTO skill_toegewezen (medewerker_id, skill_id, deadline_dagen) VALUES ($1, $2, $3)`,
        [medewerker_id, skill_id, deadline_dagen]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Fout bij opslaan skills:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}
