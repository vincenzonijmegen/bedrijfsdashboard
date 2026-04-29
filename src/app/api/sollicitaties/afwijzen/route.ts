export const runtime = "nodejs";

import { db } from "@/lib/db";
import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(value: string) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function vulTemplate(html: string, naam: string) {
  return html.replaceAll("{{naam}}", escapeHtml(naam || ""));
}

async function sendAfwijsMail(email: string, subject: string, html: string) {
  await resend.emails.send({
    from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
    to: email,
    subject,
    html,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, template_id, reden, onderwerp, mailtekst } = body;

    if (!id) {
      return NextResponse.json({ error: "id ontbreekt" }, { status: 400 });
    }

    const result = await db.query(
      `
      SELECT id, naam, email, afwijzing_verzonden_op
      FROM sollicitatie_afspraken
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    const afspraak = result.rows[0];

    if (!afspraak) {
      return NextResponse.json(
        { error: "Sollicitatieafspraak niet gevonden" },
        { status: 404 }
      );
    }

    if (afspraak.afwijzing_verzonden_op) {
      return NextResponse.json(
        { error: "Afwijzing is al verstuurd" },
        { status: 400 }
      );
    }

    if (!afspraak.email) {
      return NextResponse.json(
        { error: "Geen emailadres gevonden" },
        { status: 400 }
      );
    }

    let finalSubject = onderwerp || "Je sollicitatie bij IJssalon Vincenzo";
    let finalHtml = mailtekst || "";
    let finalReden = reden || null;
    let finalTemplateId = template_id || null;

    if (template_id && !mailtekst) {
      const templateResult = await db.query(
        `
        SELECT id, naam, onderwerp, html
        FROM sollicitatie_afwijzing_templates
        WHERE id = $1
          AND actief = true
        LIMIT 1
        `,
        [template_id]
      );

      const template = templateResult.rows[0];

      if (!template) {
        return NextResponse.json(
          { error: "Afwijzingstemplate niet gevonden" },
          { status: 404 }
        );
      }

      finalSubject = template.onderwerp;
      finalHtml = vulTemplate(template.html, afspraak.naam || "");
      finalReden = reden || template.naam;
      finalTemplateId = template.id;
    }

    if (!finalHtml.trim()) {
      return NextResponse.json(
        { error: "Geen mailtekst opgegeven" },
        { status: 400 }
      );
    }

    await sendAfwijsMail(afspraak.email, finalSubject, finalHtml);

    await db.query(
      `
      UPDATE sollicitatie_afspraken
      SET
        status = 'afgewezen',
        afgewezen_op = NOW(),
        afwijzing_verzonden_op = NOW(),
        afwijzing_mail_tekst = $2,
        afwijzingsreden = $3,
        afwijzing_template_id = $4
      WHERE id = $1
      `,
      [id, finalHtml, finalReden, finalTemplateId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fout bij afwijzen sollicitant:", error);
    return NextResponse.json(
      { error: "Afwijzen mislukt" },
      { status: 500 }
    );
  }
}