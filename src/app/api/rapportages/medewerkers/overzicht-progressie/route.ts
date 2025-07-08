import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Deze API route levert de voortgangsrapportage per medewerker:
export async function GET(req: NextRequest) {
  try {
    // 1) Haal alle medewerkers op
    const { rows: medewerkers } = await db.query(
      `SELECT id AS medewerker_id, email, naam, functie
       FROM medewerkers
       ORDER BY naam`
    );

    // 2) Bereken instructie-statistieken per medewerker
    const { rows: instructiestatus } = await db.query(
      `SELECT m.email,
              COALESCE(g.gelezen, 0) AS gelezen,
              ti.totaal,
              COALESCE(t.geslaagd, 0) AS geslaagd
       FROM medewerkers m
       LEFT JOIN (
         SELECT email, COUNT(DISTINCT instructie_id) AS gelezen
         FROM gelezen_instructies
         GROUP BY email
       ) g ON g.email = m.email
       CROSS JOIN (
         SELECT COUNT(*) AS totaal FROM instructies
       ) ti
       LEFT JOIN (
         SELECT email, COUNT(*) FILTER (WHERE score >= 80) AS geslaagd
         FROM toetsresultaten
         GROUP BY email
       ) t ON t.email = m.email`
    );

    // 3) Bereken skill-statistieken per medewerker
    const { rows: skillsstatus } = await db.query(
      `SELECT m.email,
              COALESCE(s.learned, 0) AS learned,
              COALESCE(s.total, 0) AS total
       FROM medewerkers m
       LEFT JOIN (
         SELECT st.medewerker_id::text AS email,
                SUM(CASE WHEN st.status = 'geleerd' THEN 1 ELSE 0 END) AS learned,
                COUNT(*) AS total
         FROM skill_status st
         GROUP BY st.medewerker_id
       ) s ON s.email = m.email`
    );

    return NextResponse.json({
      medewerkers,
      instructiestatus,
      skillsstatus,
    });
  } catch (err: any) {
    console.error("Fout bij opvragen rapportage data:", err);
    return NextResponse.json(
      { error: err.message || "Kon rapportage niet laden" },
      { status: 500 }
    );
  }
}
