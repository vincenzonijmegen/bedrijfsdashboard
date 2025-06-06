import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { instructieId, email } = await req.json();

    if (!instructieId || !email) {
      return NextResponse.json({ error: "Ongeldige invoer" }, { status: 400 });
    }

    await db.query(
      "INSERT INTO gelezen_instructies (gebruiker_email, instructie_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [email, instructieId]
    );

    return NextResponse.json({ status: "ok" });
  } catch (err: unknown) {
    console.error("❌ FOUT bij opslaan gelezen instructie:", err);
    return NextResponse.json({ error: "Fout bij opslaan" }, { status: 500 });
  }
}
