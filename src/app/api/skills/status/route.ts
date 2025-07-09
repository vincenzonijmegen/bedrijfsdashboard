import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { email, skill_id, status } = await req.json();

  if (!email || !skill_id || !status) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    await db.query(
      `
      INSERT INTO skill_status (medewerker_id, skill_id, status, ingevuld_op)
      VALUES (
        (SELECT id FROM medewerkers WHERE email = $1),
        $2,
        $3,
        NOW()
      )
      ON CONFLICT (medewerker_id, skill_id)
      DO UPDATE SET status = EXCLUDED.status, ingevuld_op = EXCLUDED.ingevuld_op
    `,
      [email, skill_id, status]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Fout bij opslaan skill_status:", err);
    return NextResponse.json({ error: "Databasefout" }, { status: 500 });
  }
}
