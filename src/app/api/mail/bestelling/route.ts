// app/api/mail/bestelling/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sendBestellingMail } from "@/lib/mail";

export async function POST(req: NextRequest) {
  try {
    const { naar, onderwerp, tekst } = await req.json();

    if (!naar || !onderwerp || !tekst) {
      return NextResponse.json(
        { error: "Ontbrekende gegevens" },
        { status: 400 }
      );
    }

    await sendBestellingMail(
      Array.isArray(naar) ? naar.join(", ") : String(naar),
      String(onderwerp),
      String(tekst)
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Mailfout bij /api/mail/bestelling:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}