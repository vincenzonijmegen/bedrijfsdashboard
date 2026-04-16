import { NextResponse } from "next/server";
import { renderDagrapportEmail } from "@/lib/mail/renderDagrapportEmail";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    const res = await fetch(`${baseUrl}/api/rapportage/dagrapport`, {
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok || !data?.success) {
      throw new Error("Dagrapport ophalen mislukt");
    }

    const { html } = renderDagrapportEmail(data);

    await resend.emails.send({
      from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
      to: ["herman@ijssalonvincenzo.nl"], // later uitbreiden
      subject: `Dagrapport ${data.datum}`,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Mail versturen mislukt", details: String(err) },
      { status: 500 }
    );
  }
}