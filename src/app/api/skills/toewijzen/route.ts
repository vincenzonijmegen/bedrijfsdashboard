import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!Array.isArray(body)) return NextResponse.json({ error: "Ongeldige input" }, { status: 400 });

    const { medewerker_id } = body[0] || {};
    if (!medewerker_id) return NextResponse.json({ error: "Geen medewerker_id" }, { status: 400 });

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
