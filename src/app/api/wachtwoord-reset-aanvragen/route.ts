export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import crypto from "crypto";

const TOEGESTANE_ROLLEN = ["beheerder", "accountant"];

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const result = await db.query(
      `SELECT email, naam, rol
       FROM medewerkers
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [email]
    );

    const medewerker = result.rows[0];

    /*
      Veilig stil blijven:
      - als het e-mailadres niet bestaat;
      - als het wel bestaat, maar geen beheerder/accountant is.

      Zo geven we niet prijs welke e-mailadressen in het systeem staan.
    */
    if (!medewerker) {
      return NextResponse.json({ success: true });
    }

    const rol = String(medewerker.rol || "").toLowerCase();

    if (!TOEGESTANE_ROLLEN.includes(rol)) {
      return NextResponse.json({ success: true });
    }

    const token = crypto.randomUUID();
    const verloop = new Date(Date.now() + 30 * 60 * 1000);

    await db.query(
      `INSERT INTO reset_tokens
        (token, email, token_verlopen_op)
       VALUES
        ($1, $2, $3)`,
      [token, medewerker.email, verloop.toISOString()]
    );

    const appUrl =
      process.env.APP_URL || "https://werkinstructies-app.vercel.app";

    const resetUrl = `${appUrl}/reset-wachtwoord?token=${token}`;

    const resend = new Resend(process.env.RESEND_API_KEY ?? "");

    await resend.emails.send({
      from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
      to: medewerker.email,
      subject: "Wachtwoord herstellen",
      html: `
        <p>Hallo ${medewerker.naam || ""},</p>
        <p>Je hebt een verzoek gedaan om je wachtwoord opnieuw in te stellen.</p>
        <p><a href="${resetUrl}">Klik hier om een nieuw wachtwoord in te stellen</a></p>
        <p>Deze link is 30 minuten geldig.</p>
        <p>Heb je dit niet zelf aangevraagd? Dan kun je deze mail negeren.</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Fout bij reset-aanvraag:", err);

    return NextResponse.json({ success: false }, { status: 500 });
  }
}