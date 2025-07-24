import { NextResponse } from "next/server";
import { db } from "@/lib/db"; // jouw bestaande export

export async function GET() {
  try {
    const result = await db.query(`
      WITH maandomzet AS (
        SELECT
          EXTRACT(YEAR FROM datum)::int AS jaar,
          EXTRACT(MONTH FROM datum)::int AS maand,
          SUM(aantal * eenheidsprijs) AS omzet_maand
        FROM rapportage.omzet
        WHERE datum >= '2022-01-01' AND datum < '2025-01-01'
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
        maand,
        ROUND(AVG(maand_percentage)::numeric, 5) AS gemiddelde_maandverdeling
      FROM verdeling
      GROUP BY maand
      ORDER BY maand;
    `);

    const formatted = result.rows.map((r: any) => ({
      maand: Number(r.maand),
      percentage: Number(r.gemiddelde_maandverdeling),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Fout bij ophalen maandverdeling:", error);
    return NextResponse.json({ error: "Fout bij ophalen maandverdeling" }, { status: 500 });
  }
}
