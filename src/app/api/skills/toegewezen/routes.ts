import { db } from "@/lib/db";
import { NextResponse } from "next/server";

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
