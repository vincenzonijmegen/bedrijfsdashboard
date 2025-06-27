export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY ?? "");

  try {
    const result = await db.query(`SELECT 1 FROM medewerkers WHERE email = $1`, [email]);
    if (result.rowCount === 0) {
      return NextResponse.json({ success: true }); // stil blijven voor veiligheid
    }

    const token = crypto.randomUUID();
    const verloop = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    await db.query(
      `INSERT INTO reset_tokens (token, email, token_verlopen_op) VALUES ($1, $2, $3)`,
      [token, email, verloop.toISOString()]
    );

    const resetUrl = `https://werkinstructies-app.vercel.app/reset-wachtwoord?token=${token}`;

    await resend.emails.send({
      from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
      to: email,
      subject: "Wachtwoord herstellen",
      html: `
        <p>Hallo,</p>
        <p>Je hebt een verzoek gedaan om je wachtwoord opnieuw in te stellen.</p>
        <p><a href="${resetUrl}">Klik hier om een nieuw wachtwoord in te stellen</a></p>
        <p>Deze link is 30 minuten geldig.</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Fout bij reset-aanvraag:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
