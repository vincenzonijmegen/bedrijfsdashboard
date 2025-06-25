// src/app/api/skills/toegewezen/route.ts

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const medewerker_id = Number(searchParams.get("medewerker_id"));

  if (!medewerker_id || isNaN(medewerker_id)) {
    return NextResponse.json({ error: "Ongeldig medewerker_id" }, { status: 400 });
  }

  try {
    const result = await db.query(
      `SELECT skill_naam AS skill_id,
              ROUND(EXTRACT(DAY FROM deadline - CURRENT_DATE)) AS deadline_dagen
         FROM medewerker_skills
        WHERE medewerker_id = $1`,
      [medewerker_id]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("❌ Fout bij ophalen toegewezen skills:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}
