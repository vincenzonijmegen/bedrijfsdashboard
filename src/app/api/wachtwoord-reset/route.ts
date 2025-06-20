import { db } from "@/lib/db";
import { hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { token, nieuwWachtwoord } = await req.json();
    if (!token || !nieuwWachtwoord) {
      return NextResponse.json({ error: "Token en wachtwoord zijn verplicht." }, { status: 400 });
    }

    const resultaat = await db.query(
      `SELECT email FROM wachtwoord_resets
       WHERE token = $1 AND vervaltijd > NOW()`,
      [token]
    );

    if (resultaat.rowCount === 0) {
      return NextResponse.json({ error: "Ongeldige of verlopen resetlink." }, { status: 400 });
    }

    const email = resultaat.rows[0].email;
    const wachtwoordHash = await hash(nieuwWachtwoord, 10);

    await db.query(
      `UPDATE medewerkers SET wachtwoord = $1 WHERE email = $2`,
      [wachtwoordHash, email]
    );

    await db.query(`DELETE FROM wachtwoord_resets WHERE email = $1`, [email]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Fout bij resetten wachtwoord:", err);
    return NextResponse.json({ error: "Interne fout." }, { status: 500 });
  }
}
