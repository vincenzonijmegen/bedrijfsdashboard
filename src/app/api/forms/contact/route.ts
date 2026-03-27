import { NextRequest, NextResponse } from "next/server";
import { sendContactMail } from "@/lib/mail";

function clean(v: unknown) {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const naam = clean(body.naam);
    const email = clean(body.email);
    const bericht = clean(body.bericht);

    if (!naam || !email || !bericht) {
      return NextResponse.json({ error: "Ontbrekende gegevens" }, { status: 400 });
    }

    await sendContactMail({ naam, email, bericht });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Contactformulier fout:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}