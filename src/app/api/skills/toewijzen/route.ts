import { NextResponse } from "next/server";
import { db } from "@/lib/db"; // jouw pg-pool wrapper

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Body moet een array zijn" }, { status: 400 });
    }

    for (const row of body) {
      const { medewerker_id, skill_id, deadline_dagen } = row;

      if (!medewerker_id || !skill_id) continue;

      const deadline = new Date(Date.now() + (deadline_dagen ?? 10) * 86400000);

      await db.query(
        `INSERT INTO medewerker_skills (medewerker_id, skill_naam, deadline)
         VALUES ($1, $2, $3)
         ON CONFLICT (medewerker_id, skill_naam)
         DO UPDATE SET deadline = EXCLUDED.deadline`,
        [medewerker_id, skill_id, deadline]
      );
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("❌ Fout bij skill toewijzen:", error);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}
