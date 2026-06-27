import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

const TOEGESTANE_ROLLEN = ["beheerder", "accountant"];

export async function POST(req: Request) {
  try {
    const { token, nieuwWachtwoord } = await req.json();

    if (!token || !nieuwWachtwoord) {
      return NextResponse.json(
        { success: false, error: "Ongeldige aanvraag." },
        { status: 400 }
      );
    }

    if (String(nieuwWachtwoord).length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: "Kies een wachtwoord van minimaal 8 tekens.",
        },
        { status: 400 }
      );
    }

    const result = await db.query(
      `SELECT rt.email,
              rt.token_verlopen_op,
              m.rol
       FROM reset_tokens rt
       JOIN medewerkers m
         ON lower(m.email) = lower(rt.email)
       WHERE rt.token = $1
       LIMIT 1`,
      [token]
    );

    if (result.rowCount !== 1) {
      return NextResponse.json(
        { success: false, error: "Ongeldige of verlopen link." },
        { status: 400 }
      );
    }

    const { email, token_verlopen_op, rol } = result.rows[0];

    const rolNormaal = String(rol || "").toLowerCase();

    if (!TOEGESTANE_ROLLEN.includes(rolNormaal)) {
      await db.query(`DELETE FROM reset_tokens WHERE token = $1`, [token]);

      return NextResponse.json(
        { success: false, error: "Deze resetlink is niet geldig." },
        { status: 400 }
      );
    }

    const now = new Date();
    const expiry = new Date(token_verlopen_op);

    if (expiry < now) {
      await db.query(`DELETE FROM reset_tokens WHERE token = $1`, [token]);

      return NextResponse.json(
        { success: false, error: "Resetlink is verlopen." },
        { status: 400 }
      );
    }

    const hash = await bcrypt.hash(nieuwWachtwoord, 10);

    await db.query(
      `UPDATE medewerkers
       SET wachtwoord = $1,
           moet_wachtwoord_wijzigen = false
       WHERE lower(email) = lower($2)`,
      [hash, email]
    );

    await db.query(`DELETE FROM reset_tokens WHERE token = $1`, [token]);

    return NextResponse.json({ success: true, email });
  } catch (err) {
    console.error("❌ Fout bij wachtwoord reset:", err);

    return NextResponse.json(
      { success: false, error: "Serverfout bij reset." },
      { status: 500 }
    );
  }
}