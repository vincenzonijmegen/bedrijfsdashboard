import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  try {
    const { naar, onderwerp, tekst } = await req.json();

    if (!naar || !onderwerp || !tekst) {
      return NextResponse.json(
        { error: "Ontbrekende gegevens" },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "RESEND_API_KEY ontbreekt in Vercel" },
        { status: 500 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const result = await resend.emails.send({
      from: "IJssalon Vincenzo <bestelling@ijssalonvincenzo.nl>",
      to: [naar],
      replyTo: "herman@ijssalonvincenzo.nl",
      subject: onderwerp,
      text: tekst,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <p>Beste,</p>
        <p>Hierbij onze bestelling.</p>
        <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">${tekst}</pre>
        <p>Met vriendelijke groet,<br><strong>IJssalon Vincenzo</strong></p>
      </div>`,
    });

    console.log("RESEND RESULT:", JSON.stringify(result, null, 2));

    if ((result as any)?.error) {
      return NextResponse.json(
        { error: (result as any).error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("❌ Mailfout bij /api/mail/bestelling:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}