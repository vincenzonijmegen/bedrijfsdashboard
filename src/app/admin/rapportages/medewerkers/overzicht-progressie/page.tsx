import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    // 1) Haal alle medewerkers op
    const { rows: medewerkers } = await db.query(
      `SELECT email, naam, functie FROM medewerkers ORDER BY naam`
    );

    // 2) Instructie-status: gelezen per medewerker en totaal aantal instructies
    const { rows: instr } = await db.query(
      `SELECT u.email,
              COALESCE(g.gelezen, 0) AS gelezen,
              ti.totaal,
              COALESCE(t.geslaagd, 0) AS geslaagd
       FROM (
         SELECT DISTINCT email FROM medewerkers
       ) u
       LEFT JOIN (
         SELECT email, COUNT(DISTINCT instructie_id) AS gelezen
         FROM gelezen_instructies
         GROUP BY email
       ) g ON g.email = u.email
       CROSS JOIN (
         SELECT COUNT(*) AS totaal FROM instructies
       ) ti
       LEFT JOIN (
         SELECT email, COUNT(*) FILTER (WHERE score >= 80) AS geslaagd
         FROM toetsresultaten
         GROUP BY email
       ) t ON t.email = u.email`
    );
    const instructiestatus = instr;

    // 3) Skill-status: geleerde skills en totaal per medewerker
    const { rows: skillsstatus } = await db.query(
      `SELECT u.email,
              COALESCE(s.learned, 0) AS learned,
              COALESCE(s.total, 0) AS total
       FROM (
         SELECT DISTINCT medewerker_id FROM skill_toegewezen
       ) udb
       JOIN medewerkers u ON udb.medewerker_id::text = u.email
       LEFT JOIN (
         SELECT st.medewerker_id::text AS email,
                SUM(CASE WHEN st.status = 'geleerd' THEN 1 ELSE 0 END) AS learned,
                COUNT(*) AS total
         FROM skill_status st
         GROUP BY st.medewerker_id
       ) s ON s.email = u.email`
    );

    return NextResponse.json({
      medewerkers,
      instructiestatus,
      skillsstatus,
    });
  } catch (error: any) {
    console.error("Fout bij opvragen rapportage data", error);
    return NextResponse.json(
      { error: error.message || "Kon rapportage niet laden" },
      { status: 500 }
    );
  }
}
