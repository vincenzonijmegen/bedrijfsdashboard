// src/app/api/cron/dagbriefing-mail/route.ts

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { renderBriefingEmail } from "@/lib/briefing/renderBriefingEmail";
import { getManagementMailInstellingen } from "@/lib/mail/getManagementMailInstellingen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    if (!baseUrl) {
      throw new Error("NEXT_PUBLIC_BASE_URL ontbreekt.");
    }

    const instellingen = await getManagementMailInstellingen("dagbriefing");

    if (!instellingen.soort.actief)  {
      return NextResponse.json({
        success: true,
        verzonden: false,
        reden: "Dagbriefing staat uit in mailinstellingen.",
      });
    }

    if (!instellingen.ontvangerEmails || instellingen.ontvangerEmails.length === 0) {
      return NextResponse.json({
        success: true,
        verzonden: false,
        reden: "Geen actieve ontvangers ingesteld voor dagbriefing.",
      });
    }

    const briefingRes = await fetch(`${baseUrl}/api/admin/briefing`, {
      cache: "no-store",
    });

    const briefing = await briefingRes.json();

    if (!briefingRes.ok || !briefing?.success) {
      throw new Error(
        `Dagbriefing ophalen mislukt: ${JSON.stringify(briefing)}`
      );
    }

    if (instellingen.soort.alleen_versturen_bij_rooster) {
      const ingepland =
        briefing?.onderdelen?.personeel?.data?.ingepland || [];

      if (!Array.isArray(ingepland) || ingepland.length === 0) {
        return NextResponse.json({
          success: true,
          verzonden: false,
          reden:
            "Dagbriefing niet verzonden: alleen versturen bij rooster staat aan en er staat niemand ingepland.",
          datum: briefing.datum,
          datumLabel: briefing.datumLabel,
        });
      }
    }

    const { subject, html, text } = renderBriefingEmail(briefing);

    const result = await resend.emails.send({
      from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
      to: instellingen.ontvangerEmails,
      subject,
      html,
      text,
    });

    return NextResponse.json({
      success: true,
      verzonden: true,
      mailSoort: "dagbriefing",
      datum: briefing.datum,
      datumLabel: briefing.datumLabel,
      subject,
      ontvangers: instellingen.ontvangerEmails,
      aantalOntvangers: instellingen.ontvangerEmails.length,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        bron: "cron-dagbriefing-mail",
        error: "Dagbriefing versturen mislukt",
        details: String(error),
      },
      { status: 500 }
    );
  }
}