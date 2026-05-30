// src/app/api/cron/weekrapport-mail/route.ts

import { NextResponse } from "next/server";
import { renderWeekrapportEmail } from "@/lib/mail/renderWeekrapportEmail";
import { Resend } from "resend";
import { getManagementMailInstellingen } from "@/lib/mail/getManagementMailInstellingen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  try {
    const { soort, ontvangerEmails } =
      await getManagementMailInstellingen("weekrapport");

    if (!soort.actief) {
      return NextResponse.json({
        success: true,
        verzonden: false,
        reden: "Weekrapport-mailfunctie staat uit.",
      });
    }

    if (ontvangerEmails.length === 0) {
      return NextResponse.json({
        success: true,
        verzonden: false,
        reden: "Geen actieve ontvangers ingesteld voor weekrapport.",
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    if (!baseUrl) {
      throw new Error("NEXT_PUBLIC_BASE_URL ontbreekt");
    }

    const res = await fetch(`${baseUrl}/api/rapportage/weekrapport`, {
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok || !data?.success) {
      throw new Error("Weekrapport ophalen mislukt");
    }

    const { subject, html } = renderWeekrapportEmail(data);

    const result = await resend.emails.send({
      from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
      to: ontvangerEmails,
      subject,
      html,
    });

    return NextResponse.json({
      success: true,
      verzonden: true,
      mailSoort: soort.sleutel,
      ontvangers: ontvangerEmails,
      aantalOntvangers: ontvangerEmails.length,
      result,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        verzonden: false,
        error: "Weekmail versturen mislukt",
        details: String(err),
      },
      { status: 500 }
    );
  }
}