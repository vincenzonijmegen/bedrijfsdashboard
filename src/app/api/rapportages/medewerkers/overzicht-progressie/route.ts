import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    // 1) Haal alle medewerkers op
    const medewerkersRes = await db.query(
      `SELECT email, naam, functie FROM medewerkers ORDER BY naam`
    );
    const medewerkers = medewerkersRes.rows;

    // 2) Haal instructiestatusrecords per medewerker op
    const instrRes = await db.query(
      `SELECT email, gelezen_op, score, totaal, juist
       FROM instructiestatus`
    );
    const instructiestatus = instrRes.rows;

    // 3) Haal skillstatus per medewerker op
    // We tellen vaardigheden per medewerker
    const skillsRes = await db.query(
      `SELECT s.email,
              SUM(CASE WHEN s.status = 'geleerd' THEN 1 ELSE 0 END) AS learned,
              COUNT(*) AS total
       FROM skills_status AS s
       GROUP BY s.email`
    );
    const skillsstatus = skillsRes.rows;

    return NextResponse.json({
      medewerkers,
      instructiestatus,
      skillsstatus,
    });
  } catch (error) {
    console.error("Fout bij opvragen rapportage data", error);
    return NextResponse.json(
      { error: "Kon rapportage niet laden" },
      { status: 500 }
    );
  }
}
