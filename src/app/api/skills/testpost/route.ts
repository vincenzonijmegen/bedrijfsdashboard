// src/app/api/skills/testpost/route.ts

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const medewerker_id = 1;
    const skill_naam = "testskill";
    const deadline = new Date(Date.now() + 10 * 86400000);

    const result = await db.query(
      `INSERT INTO medewerker_skills (medewerker_id, skill_naam, deadline)
       VALUES ($1, $2, $3)
       ON CONFLICT (medewerker_id, skill_naam)
       DO UPDATE SET deadline = EXCLUDED.deadline`,
      [medewerker_id, skill_naam, deadline]
    );

    return NextResponse.json({ status: "ok", rowCount: result.rowCount });
  } catch (err) {
    console.error("❌ Fout bij testinvoer:", err);
    return NextResponse.json({ error: "Fout bij testinvoer" }, { status: 500 });
  }
}
