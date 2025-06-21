// app/api/mail-pdf/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: Request) {
  const { voornaam, email, bestand } = await req.json();

  const base64 = bestand.split(",")[1];

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
      to: email,
      subject: `Sollicitatieformulier ${voornaam}`,
      html: "<p>In de bijlage vind je het PDF-bestand van de sollicitatie.</p>",
      attachments: [
        {
          filename: `sollicitatie_${voornaam}.pdf`,
          content: base64,
        }
      ]
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Mailfout bij /api/mail-pdf:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
