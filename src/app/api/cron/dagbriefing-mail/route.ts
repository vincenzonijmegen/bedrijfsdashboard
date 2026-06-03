// src/app/api/cron/dagbriefing-mail/route.ts

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { renderBriefingEmail } from "@/lib/briefing/renderBriefingEmail";
import { getManagementMailInstellingen } from "@/lib/mail/getManagementMailInstellingen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

function heeftDagrooster(briefingData: any) {
  const ingepland = briefingData?.onderdelen?.personeel?.data?.ingepland;
  return Array.isArray(ingepland) && ingepland.length > 0;
}

export async function GET(req: NextRequest) {
  try {
    const { soort, ontvangerEmails } =
      await getManagementMailInstellingen("dagbriefing");

    if (!soort.actief) {
      return NextResponse.json({
        success: true,
        verzonden: false,
        bron: "cron-dagbriefing-mail",
        reden: "Dagbriefing-mailfunctie staat uit.",
      });
    }

    if (ontvangerEmails.length === 0) {
      return NextResponse.json({
        success: true,
        verzonden: false,
        bron: "cron-dagbriefing-mail",
        reden: "Geen actieve ontvangers ingesteld voor dagbriefing.",
      });
    }

    const briefingUrl = new URL("/api/admin/briefing", req.nextUrl.origin);

    const briefingRes = await fetch(briefingUrl.toString(), {
      cache: "no-store",
    });

    const briefingData = await briefingRes.json();

    if (!briefingRes.ok || !briefingData?.success) {
      return NextResponse.json(
        {
          success: false,
          verzonden: false,
          bron: "cron-dagbriefing-mail",
          reden: "Briefing kon niet worden opgehaald.",
          status: briefingRes.status,
          details: briefingData,
        },
        { status: 500 }
      );
    }

    if (soort.alleen_versturen_bij_rooster && !heeftDagrooster(briefingData)) {
      return NextResponse.json({
        success: true,
        verzonden: false,
        bron: "cron-dagbriefing-mail",
        reden:
          "Niet verzonden: instelling 'alleen bij dagrooster' staat aan en er staan geen medewerkers ingepland.",
        datum: briefingData.datum,
        datumLabel: briefingData.datumLabel,
      });
    }

    const email = renderBriefingEmail(briefingData);

    const result = await resend.emails.send({
      from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
      to: ontvangerEmails,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    return NextResponse.json({
      success: true,
      verzonden: true,
      bron: "cron-dagbriefing-mail",
      datum: briefingData.datum,
      datumLabel: briefingData.datumLabel,
      subject: email.subject,
      ontvangers: ontvangerEmails,
      aantalOntvangers: ontvangerEmails.length,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        verzonden: false,
        bron: "cron-dagbriefing-mail",
        error: `Cron dagbriefing kon niet worden uitgevoerd: ${String(error)}`,
      },
      { status: 500 }
    );
  }
}