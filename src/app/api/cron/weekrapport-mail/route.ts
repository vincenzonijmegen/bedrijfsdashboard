// src/app/api/cron/weekrapport-mail/route.ts

import { NextResponse } from "next/server";
import { renderWeekrapportEmail } from "@/lib/mail/renderWeekrapportEmail";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    const res = await fetch(`${baseUrl}/api/rapportage/weekrapport`, {
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok || !data?.success) {
      throw new Error("Weekrapport ophalen mislukt");
    }

    const { subject, html } = renderWeekrapportEmail(data);

    await resend.emails.send({
      from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
      to: ["herman@ijssalonvincenzo.nl", "erik@ijssalonvincenzo.nl"],
      subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Weekmail versturen mislukt", details: String(err) },
      { status: 500 }
    );
  }
}