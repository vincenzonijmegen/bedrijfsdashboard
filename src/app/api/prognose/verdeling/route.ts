import { NextResponse } from "next/server";
import { db } from "@/lib/db"; // jouw bestaande export

export async function GET() {
  try {
    const result = await db.query(`
  WITH geldige_jaren AS (
    SELECT DISTINCT EXTRACT(YEAR FROM datum)::int AS jaar
    FROM rapportage.omzet
    WHERE datum >= '2022-01-01'
      AND EXTRACT(YEAR FROM datum)::int < EXTRACT(YEAR FROM CURRENT_DATE)::int
  ),
  maandomzet AS (
    SELECT
      EXTRACT(YEAR FROM datum)::int AS jaar,
      EXTRACT(MONTH FROM datum)::int AS maand,
      SUM(aantal * eenheidsprijs) AS omzet_maand
    FROM rapportage.omzet
    WHERE EXTRACT(YEAR FROM datum)::int IN (SELECT jaar FROM geldige_jaren)
    GROUP BY jaar, maand
  ),
  jaaromzet AS (
    SELECT
      jaar,
      SUM(omzet_maand) AS omzet_jaar
    FROM maandomzet
    GROUP BY jaar
  ),
  verdeling AS (
    SELECT
      m.jaar,
      m.maand,
      ROUND((m.omzet_maand / j.omzet_jaar)::numeric, 5) AS maand_percentage
    FROM maandomzet m
    JOIN jaaromzet j ON m.jaar = j.jaar
  )
  SELECT
    v.maand,
    ROUND(AVG(v.maand_percentage)::numeric, 5) AS percentage,
    COUNT(DISTINCT v.jaar) AS aantal_jaren
  FROM verdeling v
  GROUP BY v.maand
  ORDER BY v.maand;
`);

 // Extract hoeveel unieke jaren zijn gebruikt (gelijk voor elke rij)
 const vorigJaar = new Date().getFullYear() - 1;
const totaalVorigJaar = await db.query(`
  SELECT SUM(aantal * eenheidsprijs) AS totaal
  FROM rapportage.omzet
  WHERE EXTRACT(YEAR FROM datum)::int = $1
`, [vorigJaar]);

const omzetVorigJaar = Number(totaalVorigJaar.rows[0]?.totaal || 0);
const groeibedrag = Math.round(omzetVorigJaar * 1.03);
   
 
 
 const aantalJaren = result.rows[0]?.aantal_jaren || 0;

    const verdeling = result.rows.map((r: any) => ({
      maand: Number(r.maand),
      percentage: Number(r.percentage),
    }));
   const formatted = result.rows.map((r: any) => ({
      maand: Number(r.maand),
      percentage: Number(r.gemiddelde_maandverdeling),
    }));



return NextResponse.json({
  jaren: aantalJaren,
  verdeling,
  omzetPrognose: groeibedrag
});
  } catch (error) {
    console.error("Fout bij ophalen maandverdeling:", error);
    return NextResponse.json({ error: "Fout bij ophalen maandverdeling" }, { status: 500 });
  }
}
