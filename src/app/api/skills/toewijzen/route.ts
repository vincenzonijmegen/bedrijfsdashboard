// src/app/api/skills/toewijzen/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { mailVersturen as sendMail } from "@/lib/mail"; // bestaande resend-routine

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
          await sendMail({
            to: gegevens.email,
            subject: `Nieuwe skill: ${gegevens.skill_naam}`,
            tekst: `${gegevens.naam},

Je hebt een nieuwe skill toegewezen gekregen: ${gegevens.skill_naam}.
Leer deze binnen ${deadline_dagen || 10} dagen.`
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Fout bij toewijzen skills:", err);
    return NextResponse.json({ error: "Fout bij verwerken" }, { status: 500 });
  }
}
