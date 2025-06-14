import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { token, nieuwWachtwoord } = await req.json();

    const result = await db.query(
      `SELECT email, token_verlopen_op FROM reset_tokens WHERE token = $1`,
      [token]
    );

    if (result.rowCount !== 1) {
      return NextResponse.json({ success: false, error: "Ongeldige of verlopen link." }, { status: 400 });
    }

    const { email, token_verlopen_op } = result.rows[0];

    const now = new Date();
    const expiry = new Date(token_verlopen_op);
    if (expiry < now) {
      return NextResponse.json({ success: false, error: "Resetlink is verlopen." }, { status: 400 });
    }

    const hash = await bcrypt.hash(nieuwWachtwoord, 10);

    await db.query(
      `UPDATE medewerkers SET wachtwoord = $1, moet_wachtwoord_wijzigen = false WHERE email = $2`,
      [hash, email]
    );

    await db.query(`DELETE FROM reset_tokens WHERE token = $1`, [token]);

    return NextResponse.json({ success: true, email });
  } catch (err) {
    console.error("❌ Fout bij wachtwoord reset:", err);
    return NextResponse.json({ success: false, error: "Serverfout bij reset." }, { status: 500 });
  }
}
