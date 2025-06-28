// app/api/mail/bestelling/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  const { naar, onderwerp, tekst } = await req.json();

  if (!naar || !onderwerp || !tekst) {
    return NextResponse.json({ error: "Ontbrekende gegevens" }, { status: 400 });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
      to: naar,
      subject: onderwerp,
      text: tekst,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Mailfout bij /api/mail/bestelling:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
