import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const { email, nieuwWachtwoord } = await req.json();

  try {
    const hashed = await bcrypt.hash(nieuwWachtwoord, 10);
    await db.query(
      `UPDATE medewerkers SET wachtwoord = $1, moet_wachtwoord_wijzigen = false WHERE email = $2`,
      [hashed, email]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Fout bij wachtwoord wijzigen:", err);
    return NextResponse.json({ success: false, error: "Wijzigen mislukt" }, { status: 500 });
  }
}
