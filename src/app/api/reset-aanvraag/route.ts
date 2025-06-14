import { db } from "@/lib/db";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ success: false, error: "E-mailadres vereist" }, { status: 400 });
  }

  try {
    // Controleer of dit e-mailadres bestaat
    const result = await db.query(`SELECT * FROM medewerkers WHERE email = $1`, [email]);
    if (result.rowCount !== 1) {
      // Antwoord blijft neutraal — geen infolek
      return NextResponse.json({ success: true });
    }

    const token = crypto.randomUUID();
    const verloop = new Date(Date.now() + 30 * 60 * 1000); // 30 minuten geldig

    await db.query(
      `UPDATE medewerkers SET reset_token = $1, reset_token_verloopt = $2 WHERE email = $3`,
      [token, verloop.toISOString(), email]
    );

    const resetUrl = `https://werkinstructies-app.vercel.app/reset-wachtwoord?token=${token}`;

    await resend.emails.send({
      from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
      to: email,
      subject: "Wachtwoord herstellen - IJssalon Vincenzo",
      html: `
        <p>Hallo,</p>
        <p>Je hebt een verzoek gedaan om je wachtwoord opnieuw in te stellen.</p>
        <p><a href="${resetUrl}">Klik hier om een nieuw wachtwoord in te stellen</a></p>
        <p>Deze link is 30 minuten geldig.</p>
        <p>Groet,<br/>IJssalon Vincenzo</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Fout bij reset-aanvraag:", err);
    return NextResponse.json({ success: false, error: "Serverfout" }, { status: 500 });
  }
}
