// src/app/api/skills/toegewezen/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const medewerker_id = Number(searchParams.get("medewerker_id"));

  if (!medewerker_id || isNaN(medewerker_id)) {
    return NextResponse.json({ error: "Ongeldig medewerker_id" }, { status: 400 });
  }

  try {
    const result = await db.query(
      `SELECT skill_id, deadline_dagen
       FROM skill_toegewezen
       WHERE medewerker_id = $1`,
      [medewerker_id]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("❌ Fout bij ophalen toegewezen skills:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
  
}
export async function DELETE(req: NextRequest) {
  const { medewerker_id, skill_id } = await req.json();

  if (!medewerker_id || !skill_id) {
    return NextResponse.json({ error: "Ongeldig verzoek" }, { status: 400 });
  }

  // Check status eerst
  const result = await db.query(
    `SELECT status FROM skill_status WHERE medewerker_id = $1 AND skill_id = $2`,
    [medewerker_id, skill_id]
  );

  const status = result.rows[0]?.status;
  if (status === "geleerd") {
    return NextResponse.json({ error: "Kan geleerde skill niet verwijderen" }, { status: 403 });
  }

  // Verwijder uit skill_toegewezen én status
  await db.query(
    `DELETE FROM skill_toegewezen WHERE medewerker_id = $1 AND skill_id = $2`,
    [medewerker_id, skill_id]
  );

  await db.query(
    `DELETE FROM skill_status WHERE medewerker_id = $1 AND skill_id = $2`,
    [medewerker_id, skill_id]
  );

  return NextResponse.json({ success: true });
}