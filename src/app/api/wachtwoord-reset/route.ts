import { db } from "@/lib/db";
import { hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

const TOEGESTANE_ROLLEN = ["beheerder", "accountant"];

export async function POST(req: NextRequest) {
  try {
    const { token, nieuwWachtwoord } = await req.json();

    if (!token || !nieuwWachtwoord) {
      return NextResponse.json(
        { error: "Token en wachtwoord zijn verplicht." },
        { status: 400 }
      );
    }

    if (String(nieuwWachtwoord).length < 8) {
      return NextResponse.json(
        { error: "Kies een wachtwoord van minimaal 8 tekens." },
        { status: 400 }
      );
    }

    const resultaat = await db.query(
      `SELECT wr.email,
              m.rol
       FROM wachtwoord_resets wr
       JOIN medewerkers m
         ON lower(m.email) = lower(wr.email)
       WHERE wr.token = $1
         AND wr.vervaltijd > NOW()
       LIMIT 1`,
      [token]
    );

    if (resultaat.rowCount === 0) {
      return NextResponse.json(
        { error: "Ongeldige of verlopen resetlink." },
        { status: 400 }
      );
    }

    const { email, rol } = resultaat.rows[0];
    const rolNormaal = String(rol || "").toLowerCase();

    if (!TOEGESTANE_ROLLEN.includes(rolNormaal)) {
      await db.query(`DELETE FROM wachtwoord_resets WHERE token = $1`, [token]);

      return NextResponse.json(
        { error: "Deze resetlink is niet geldig." },
        { status: 400 }
      );
    }

    const wachtwoordHash = await hash(nieuwWachtwoord, 10);

    await db.query(
      `UPDATE medewerkers
       SET wachtwoord = $1,
           moet_wachtwoord_wijzigen = false
       WHERE lower(email) = lower($2)`,
      [wachtwoordHash, email]
    );

    await db.query(`DELETE FROM wachtwoord_resets WHERE email = $1`, [email]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Fout bij resetten wachtwoord:", err);

    return NextResponse.json(
      { error: "Interne fout." },
      { status: 500 }
    );
  }
}