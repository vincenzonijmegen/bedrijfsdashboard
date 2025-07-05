export const runtime = "nodejs"; // Gebruik Node.js i.p.v. Edge (vereist voor pg)

import { db } from "@/lib/db";
import { sendReminderMail } from "@/lib/mail";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const result = await db.query(`
    SELECT
      m.naam AS medewerker_naam,
      m.email AS medewerker_email,
      s.naam AS skill_naam,
      st.deadline_dagen,
      ss.status,
      st.toegewezen_op,
      CURRENT_DATE + (st.deadline_dagen || ' days')::interval AS deadline
    FROM skill_toegewezen st
    JOIN medewerkers m ON m.id = st.medewerker_id
    JOIN skills s ON s.id = st.skill_id
    JOIN skill_status ss ON ss.skill_id = s.id AND ss.medewerker_id = m.id
    WHERE ss.status != 'geleerd'
  `);

  const vandaag = new Date();
  let aantalMails = 0;

  for (const row of result.rows) {
    const deadline = new Date(row.deadline);
    const verschil = Math.ceil((deadline.getTime() - vandaag.getTime()) / (1000 * 60 * 60 * 24));

    if (verschil === 3) {
      await sendReminderMail(row.medewerker_email, row.medewerker_naam, row.skill_naam, deadline);
      aantalMails++;
    }
  }

  return NextResponse.json({ success: true, verstuurd: aantalMails });
}
