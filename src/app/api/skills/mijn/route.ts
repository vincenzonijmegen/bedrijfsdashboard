import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const rawEmail = req.headers.get("x-user-email");
  const userEmail = rawEmail?.toLowerCase().trim();

  if (!userEmail) {
    return NextResponse.json({ skills: [], warning: "Geen e-mail meegegeven" }, { status: 200 });
  }

  try {
    const result = await db.query(`
      SELECT
      s.id AS skill_id,
      s.naam AS skill_naam,
      s.beschrijving AS omschrijving,         -- ✅ alias naar 'omschrijving'
      c.naam AS categorie,
      ss.status,
      CURRENT_DATE + (st.deadline_dagen || ' days')::interval AS deadline  -- ✅ berekende echte datum
      FROM skill_status ss
      JOIN medewerkers m ON m.id = ss.medewerker_id
      JOIN skills s ON s.id = ss.skill_id
      LEFT JOIN skill_categorieen c ON c.id = s.categorie_id
      LEFT JOIN skill_toegewezen st ON st.medewerker_id = ss.medewerker_id AND st.skill_id = ss.skill_id
      WHERE LOWER(m.email) = $1
      ORDER BY c.naam, s.naam
    `, [userEmail]);

    return NextResponse.json({ skills: result.rows });
  } catch (err) {
    return NextResponse.json({ skills: [], warning: "Databasefout", details: String(err) }, { status: 500 });
  }
}
