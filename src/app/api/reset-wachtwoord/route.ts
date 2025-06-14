import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const { token, nieuwWachtwoord } = await req.json();

  if (!token || !nieuwWachtwoord) {
    return NextResponse.json({ success: false, error: "Ongeldige aanvraag" }, { status: 400 });
  }

  try {
    const result = await db.query(
      `SELECT * FROM medewerkers WHERE reset_token = $1 AND reset_token_verloopt > NOW()`,
      [token]
    );

    if (result.rowCount !== 1) {
      return NextResponse.json({ success: false, error: "Ongeldige of verlopen resetlink" }, { status: 400 });
    }

    const medewerker = result.rows[0];
    const hash = await bcrypt.hash(nieuwWachtwoord, 10);

    await db.query(
      `UPDATE medewerkers SET wachtwoord = $1, reset_token = NULL, reset_token_verloopt = NULL, moet_wachtwoord_wijzigen = false WHERE id = $2`,
      [hash, medewerker.id]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Fout bij wachtwoord-reset:", err);
    return NextResponse.json({ success: false, error: "Serverfout" }, { status: 500 });
  }
}
