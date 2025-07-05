export const runtime = "nodejs"; // Gebruik Node.js i.p.v. Edge (vereist voor pg)

import { db } from "@/lib/db";
import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendSkillUpdateMail(email: string, naam: string, aantal: number) {
  const subject = `📘 Er zijn ${aantal} nieuwe skills aan jou toegewezen`;
  const body = `
    <p>Hallo ${naam},</p>
    <p>Er ${aantal === 1 ? 'is' : 'zijn'} ${aantal} skill${aantal > 1 ? 's' : ''} aan jou toegewezen.</p>
    <p>Bekijk je skilllijst via het werkinstructieportaal:</p>
    <p><a href="https://werkinstructies-app.vercel.app/skills">Ga naar je dashboard</a></p>
    <p>Met vriendelijke groet,<br/>IJssalon Vincenzo</p>
  `;

  await resend.emails.send({
    from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
    to: email,
    subject,
    html: body,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { items, sendEmail } = body; // items: array van toewijzingen

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Geen toewijzingen ontvangen" }, { status: 400 });
  }

  const emailMap: Record<string, { naam: string; email: string; aantal: number }> = {};

  for (const item of items) {
    const { medewerker_id, skill_id, deadline_dagen } = item;

    if (!medewerker_id || !skill_id) continue;

    await db.query(
      `INSERT INTO skill_toegewezen (medewerker_id, skill_id, deadline_dagen)
       VALUES ($1, $2, $3)
       ON CONFLICT (medewerker_id, skill_id) DO UPDATE
       SET deadline_dagen = EXCLUDED.deadline_dagen`,
      [medewerker_id, skill_id, deadline_dagen || 10]
    );

    await db.query(`
      INSERT INTO skill_status (medewerker_id, skill_id, status)
      SELECT $1, $2, 'niet_geleerd'
      WHERE NOT EXISTS (
        SELECT 1 FROM skill_status
        WHERE medewerker_id = $1 AND skill_id = $2
      )
    `, [medewerker_id, skill_id]);

    if (sendEmail) {
      const result = await db.query(
        `SELECT m.naam, m.email FROM medewerkers m WHERE m.id = $1`,
        [medewerker_id]
      );

      const gegevens = result.rows?.[0];
      if (gegevens?.email) {
        if (!emailMap[gegevens.email]) {
          emailMap[gegevens.email] = {
            naam: gegevens.naam,
            email: gegevens.email,
            aantal: 1
          };
        } else {
          emailMap[gegevens.email].aantal++;
        }
      }
    }
  }

  if (sendEmail) {
    for (const [, gegevens] of Object.entries(emailMap)) {
      await sendSkillUpdateMail(gegevens.email, gegevens.naam, gegevens.aantal);
    }
  }

  return NextResponse.json({ success: true });
}
