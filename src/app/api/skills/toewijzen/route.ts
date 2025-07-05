// src/app/api/skills/toewijzen/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { sendSkillMail as sendMail } from "@/lib/mail";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, sendEmail } = body; // items: array van toewijzingen

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Geen toewijzingen ontvangen" }, { status: 400 });
    }

    for (const item of items) {
      const { medewerker_id, skill_id, deadline_dagen } = item;

      if (!medewerker_id || !skill_id) continue;

      // Upsert de toewijzing met deadline in dagen
      await db.query(
        `INSERT INTO skill_toegewezen (medewerker_id, skill_id, deadline_dagen)
         VALUES ($1, $2, $3)
         ON CONFLICT (medewerker_id, skill_id) DO UPDATE
         SET deadline_dagen = EXCLUDED.deadline_dagen`,
        [medewerker_id, skill_id, deadline_dagen || 10]
      );

// Voeg toe aan skill_status (status = 'open'), maar alleen als nog niet aanwezig
    await db.query(`
      INSERT INTO skill_status (medewerker_id, skill_id, status)
      SELECT $1, $2, 'open'
      WHERE NOT EXISTS (
        SELECT 1 FROM skill_status
        WHERE medewerker_id = $1 AND skill_id = $2
      )
    `, [medewerker_id, skill_id]);

      // Mail indien aangevinkt
      if (sendEmail) {
        const result = await db.query(
          `SELECT m.naam, m.email, s.naam as skill_naam
           FROM medewerkers m
           JOIN skills s ON s.id = $1
           WHERE m.id = $2`,
          [skill_id, medewerker_id]
        );

        const gegevens = result.rows?.[0];
        if (gegevens?.email) {
          await sendMail(
            gegevens.email,
            gegevens.naam,
            gegevens.skill_naam,
            deadline_dagen || 10
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Fout bij toewijzen skills:", err);
    return NextResponse.json({ error: "Fout bij verwerken" }, { status: 500 });
  }
}
