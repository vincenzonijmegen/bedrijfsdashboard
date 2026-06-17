// src/app/api/cron/onboarding-reminders/route.ts

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

type ReminderType = "reminder_2d" | "reminder_5d";

function tekstZonderHtml(html: string) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDatum(value: string | null | undefined) {
  if (!value) return "";

  try {
    return new Date(value).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(value);
  }
}

function renderReminderMail(opdracht: any, url: string, type: ReminderType) {
  const titel = opdracht.nummer
    ? `${opdracht.nummer}. ${opdracht.titel}`
    : opdracht.titel;

  const naam = opdracht.medewerker_naam || "";
  const verzondenDatum = formatDatum(opdracht.verzonden_op);

  const isTweedeReminder = type === "reminder_5d";

  const subject = isTweedeReminder
    ? `Herinnering: rond je onboarding-instructie af - ${titel}`
    : `Reminder onboarding Vincenzo - ${titel}`;

  const intro = isTweedeReminder
    ? `De instructie "${titel}" staat nog steeds open. Wil je deze uiterlijk morgen afronden?`
    : `Je hebt de instructie "${titel}" nog openstaan. Wil je deze vandaag of morgen even doornemen en afronden?`;

  const extra = isTweedeReminder
    ? "Als de link niet werkt, kopieer deze dan naar Safari, Chrome of Edge."
    : "Dit helpt ons om iedereen goed en veilig ingewerkt te houden.";

  const html = `
    <div style="margin:0; padding:0; background:#f1f5f9; font-family:Arial, sans-serif; color:#0f172a;">
      <div style="max-width:680px; margin:0 auto; padding:24px;">
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:18px; padding:24px;">
          <p style="margin:0 0 12px 0; color:#475569;">Hallo ${naam},</p>

          <h1 style="margin:0 0 12px 0; font-size:22px; line-height:1.25;">
            Onboarding herinnering
          </h1>

          <p style="margin:0 0 12px 0; color:#334155; line-height:1.55;">
            ${intro}
          </p>

          <p style="margin:0 0 18px 0; color:#475569; line-height:1.55;">
            ${extra}
          </p>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:14px; margin:18px 0;">
            <div style="font-weight:700; color:#0f172a;">${titel}</div>
            ${
              verzondenDatum
                ? `<div style="margin-top:4px; color:#64748b; font-size:13px;">Aangeboden op ${verzondenDatum}</div>`
                : ""
            }
          </div>

          <p style="margin:20px 0;">
            <a href="${url}"
               style="display:inline-block; background:#2563eb; color:#ffffff; text-decoration:none; padding:12px 18px; border-radius:12px; font-weight:700;">
              Open instructie
            </a>
          </p>

          <p style="margin:18px 0 0 0; color:#64748b; font-size:13px; line-height:1.5;">
            Werkt de knop niet of blijft de pagina laden? Kopieer dan deze link naar Safari, Chrome of Edge:<br />
            <span style="word-break:break-all;">${url}</span>
          </p>
        </div>
      </div>
    </div>
  `;

  const text = [
    `Hallo ${naam},`,
    "",
    "Onboarding herinnering",
    "",
    intro,
    "",
    extra,
    "",
    titel,
    verzondenDatum ? `Aangeboden op ${verzondenDatum}` : "",
    "",
    `Open instructie: ${url}`,
    "",
    tekstZonderHtml(opdracht.inhoud || ""),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject,
    html,
    text,
  };
}

async function haalReminderKandidaten(type: ReminderType, dagenOpen: number) {
  const result = await db.query(
    `
    SELECT
      o.id,
      o.medewerker_email,
      o.instructie_id,
      o.token,
      o.status,
      o.verzonden_op,
      o.afgerond_op,
      m.naam AS medewerker_naam,
      i.nummer,
      i.titel,
      i.inhoud
    FROM onboarding_opdrachten o
    JOIN medewerkers m
      ON LOWER(m.email) = LOWER(o.medewerker_email)
    JOIN instructies i
      ON i.id = o.instructie_id
    WHERE o.status = 'verzonden'
      AND o.afgerond_op IS NULL
      AND o.verzonden_op <= NOW() - ($1::int * INTERVAL '1 day')
      AND NOT EXISTS (
        SELECT 1
        FROM onboarding_herinneringen h
        WHERE h.onboarding_opdracht_id = o.id
          AND h.type = $2
      )
    ORDER BY o.verzonden_op ASC
    LIMIT 25
    `,
    [dagenOpen, type]
  );

  return result.rows;
}

async function verstuurReminderType({
  type,
  dagenOpen,
  origin,
}: {
  type: ReminderType;
  dagenOpen: number;
  origin: string;
}) {
  const kandidaten = await haalReminderKandidaten(type, dagenOpen);

  const verzonden: any[] = [];
  const fouten: any[] = [];

  for (const opdracht of kandidaten) {
    const url = new URL(`/onboarding/${opdracht.token}`, origin).toString();
    const email = renderReminderMail(opdracht, url, type);

    try {
      const result = await resend.emails.send({
        from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
        to: [opdracht.medewerker_email],
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      await db.query(
        `
        INSERT INTO onboarding_herinneringen (
          onboarding_opdracht_id,
          type,
          verzonden_op
        )
        VALUES ($1, $2, NOW())
        ON CONFLICT (onboarding_opdracht_id, type)
        DO NOTHING
        `,
        [opdracht.id, type]
      );

      verzonden.push({
        medewerker_email: opdracht.medewerker_email,
        medewerker_naam: opdracht.medewerker_naam,
        instructie: opdracht.titel,
        type,
        result,
      });
    } catch (error) {
      fouten.push({
        medewerker_email: opdracht.medewerker_email,
        medewerker_naam: opdracht.medewerker_naam,
        instructie: opdracht.titel,
        type,
        error: String(error),
      });
    }
  }

  return {
    type,
    dagenOpen,
    gevonden: kandidaten.length,
    verzonden,
    fouten,
  };
}

const APP_ORIGIN = "https://werkinstructies-app.vercel.app";

export async function GET() {
  try {
    const origin = APP_ORIGIN;

    const reminder2d = await verstuurReminderType({
      type: "reminder_2d",
      dagenOpen: 2,
      origin,
    });

    const reminder5d = await verstuurReminderType({
      type: "reminder_5d",
      dagenOpen: 5,
      origin,
    });

    return NextResponse.json({
      success: true,
      bron: "cron-onboarding-reminders",
      resultaat: {
        reminder2d,
        reminder5d,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        bron: "cron-onboarding-reminders",
        error: `Onboarding reminders konden niet worden verstuurd: ${String(
          error
        )}`,
      },
      { status: 500 }
    );
  }
}