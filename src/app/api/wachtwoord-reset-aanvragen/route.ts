import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    const gebruiker = await db.query("SELECT email FROM gebruikers WHERE email = $1", [email]);
    if (gebruiker.rowCount === 0) {
      return NextResponse.json({ error: "E-mailadres niet gevonden." }, { status: 404 });
    }

    const token = randomUUID();
    const vervaltijd = new Date(Date.now() + 1000 * 60 * 30); // 30 minuten geldig

    await db.query(
      `INSERT INTO wachtwoord_resets (email, token, vervaltijd)
       VALUES ($1, $2, $3)`,
      [email, token, vervaltijd]
    );

    const resetLink = `${process.env.NEXT_PUBLIC_SITE_URL}/wachtwoord-reset?token=${token}`;

    await resend.emails.send({
      from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
      to: email,
      subject: "Wachtwoord herstellen",
      text: `Klik op onderstaande link om je wachtwoord opnieuw in te stellen. Deze link is 30 minuten geldig.

${resetLink}`
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Fout bij versturen resetlink:", err);
    return NextResponse.json({ error: "Interne fout." }, { status: 500 });
  }
}
