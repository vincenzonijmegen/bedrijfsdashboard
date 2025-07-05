// /api/skills/mijn



import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";




export async function GET(req: NextRequest) {
const userEmail = req.headers.get("x-user-email");
if (!userEmail) {
  return NextResponse.json({ skills: [], warning: "Geen e-mail meegegeven" }, { status: 200 });
}

const result = await db.query(`
  SELECT
    s.id,
    s.naam AS skill_naam,
    c.naam AS categorie,
    ss.status,
    ss.toelichting,
    ss.datum_geleerd
  FROM skill_status ss
  JOIN medewerkers m ON m.id = ss.medewerker_id
  JOIN skills s ON s.id = ss.skill_id
  LEFT JOIN skill_categorieen c ON c.id = s.categorie_id
  WHERE m.email = $1
  ORDER BY c.naam, s.naam
`, [userEmail]);


    return NextResponse.json({ skills: result.rows });
  } catch (err) {
    return NextResponse.json({ skills: [], warning: "Databasefout", details: String(err) }, { status: 200 });
  }

