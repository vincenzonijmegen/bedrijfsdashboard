// src/app/api/admin/briefing/mail/route.ts

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { renderBriefingEmail } from "@/lib/briefing/renderBriefingEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);
const DAGBRIEFING_SLEUTEL = "dagbriefing";

type MailSoort = {
  sleutel: string;
  naam: string;
  actief: boolean;
  alleen_versturen_bij_rooster: boolean;
};

type MailOntvanger = {
  id: number;
  naam: string | null;
  email: string;
  actief: boolean;
};

async function haalMailInstellingen() {
  const soortResult = await db.query(
    `
    SELECT
      sleutel,
      naam,
      actief,
      alleen_versturen_bij_rooster
    FROM management_mail_soorten
    WHERE sleutel = $1
    LIMIT 1
    `,
    [DAGBRIEFING_SLEUTEL]
  );

  const soort = soortResult.rows[0] as MailSoort | undefined;

  if (!soort) {
    throw new Error("Mailsoort dagbriefing bestaat niet.");
  }

  const ontvangersResult = await db.query(
    `
    SELECT
      id,
      naam,
      email,
      actief
    FROM management_mail_ontvangers
    WHERE mail_soort_sleutel = $1
      AND actief = true
    ORDER BY naam ASC NULLS LAST, email ASC
    `,
    [DAGBRIEFING_SLEUTEL]
  );

  return {
    soort,
    ontvangers: ontvangersResult.rows as MailOntvanger[],
  };
}

function heeftDagrooster(briefingData: any) {
  const ingepland = briefingData?.onderdelen?.personeel?.data?.ingepland;
  return Array.isArray(ingepland) && ingepland.length > 0;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const datum = body?.datum ? String(body.datum) : null;

    const { soort, ontvangers } = await haalMailInstellingen();

    if (!soort.actief) {
      return NextResponse.json({
        success: false,
        verzonden: false,
        reden: "Dagbriefing-mailfunctie staat uit.",
      });
    }

    if (ontvangers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          verzonden: false,
          reden: "Er zijn geen actieve ontvangers ingesteld.",
        },
        { status: 400 }
      );
    }

    const briefingUrl = new URL("/api/admin/briefing", req.nextUrl.origin);

    if (datum) {
      briefingUrl.searchParams.set("datum", datum);
    }

    const briefingRes = await fetch(briefingUrl.toString(), {
      cache: "no-store",
    });

    const briefingData = await briefingRes.json();

    if (!briefingRes.ok || !briefingData?.success) {
      return NextResponse.json(
        {
          success: false,
          verzonden: false,
          reden: "Briefing kon niet worden opgehaald.",
          details: briefingData,
        },
        { status: 500 }
      );
    }

    if (soort.alleen_versturen_bij_rooster && !heeftDagrooster(briefingData)) {
      return NextResponse.json({
        success: true,
        verzonden: false,
        reden:
          "Niet verzonden: instelling 'alleen bij dagrooster' staat aan en er staan geen medewerkers ingepland.",
        datum: briefingData.datum,
        datumLabel: briefingData.datumLabel,
      });
    }

    const email = renderBriefingEmail(briefingData);
    const ontvangerEmails = ontvangers.map((ontvanger) => ontvanger.email);

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
        error: `Dagbriefing kon niet worden verzonden: ${String(error)}`,
      },
      { status: 500 }
    );
  }
}