import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { skill_id, status } = await req.json();
  const email = req.cookies.get("email")?.value;

  if (!email || !skill_id || !status) {
    return NextResponse.json({ error: "Ongeldig verzoek" }, { status: 400 });
  }

  try {
    const medewerkerResult = await db.query(
      `SELECT id FROM medewerkers WHERE email = $1`,
      [email]
    );

    const medewerker = medewerkerResult.rows[0];
    if (!medewerker) {
      return NextResponse.json({ error: "Medewerker niet gevonden" }, { status: 404 });
    }

    await db.query(
      `UPDATE skill_status SET status = $1 WHERE medewerker_id = $2 AND skill_id = $3`,
      [status, medewerker.id, skill_id]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Fout bij skill-status update:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}
