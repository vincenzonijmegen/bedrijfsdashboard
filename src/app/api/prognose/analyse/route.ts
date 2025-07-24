// src/app/api/prognose/analyse/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Stap 1: Bepaal omzet vorig jaar
    const vorigJaar = new Date().getFullYear() - 1;
    const vorigJaarOmzetRes = await db.query(
      `SELECT SUM(aantal * eenheidsprijs) AS totaal
       FROM rapportage.omzet
       WHERE EXTRACT(YEAR FROM datum)::int = $1`,
      [vorigJaar]
    );
    const vorigJaarOmzet = Number(vorigJaarOmzetRes.rows[0]?.totaal || 0);
    const jaaromzet = Math.round(vorigJaarOmzet * 1.03);

    // Stap 2: Haal maandverdeling op (prognose % per maand)
    const verdelingRes = await db.query(`
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
        SELECT jaar, SUM(omzet_maand) AS omzet_jaar FROM maandomzet GROUP BY jaar
      ),
      verdeling AS (
        SELECT m.jaar, m.maand,
        (m.omzet_maand / j.omzet_jaar)::numeric AS maand_percentage
        FROM maandomzet m
        JOIN jaaromzet j ON m.jaar = j.jaar
      )
      SELECT maand, ROUND(AVG(maand_percentage)::numeric, 5) AS percentage
      FROM verdeling
      GROUP BY maand
      ORDER BY maand;
    `);

    const maandverdeling: Record<number, number> = {};
    verdelingRes.rows.forEach((row) => {
      maandverdeling[Number(row.maand)] = Number(row.percentage);
    });

    // Stap 3: Haal realisatie per maand
    const realisatieRes = await db.query(`
      SELECT EXTRACT(MONTH FROM datum)::int AS maand,
             COUNT(DISTINCT datum) AS dagen,
             SUM(aantal * eenheidsprijs) AS omzet
      FROM rapportage.omzet
      WHERE EXTRACT(YEAR FROM datum)::int = EXTRACT(YEAR FROM CURRENT_DATE)::int
      GROUP BY maand
      ORDER BY maand;
    `);

    const realisatieMap: Record<number, { dagen: number; omzet: number }> = {};
    realisatieRes.rows.forEach((r) => {
      realisatieMap[Number(r.maand)] = {
        dagen: Number(r.dagen),
        omzet: Number(r.omzet),
      };
    });

    // Stap 4: Combineer per maand (maart t/m september)
    const maanden = [3, 4, 5, 6, 7, 8, 9];
    let cumulatiefPlus = 0;
    let cumulatiefPrognose = 0;
    let cumulatiefRealisatie = 0;

    const resultaten = maanden.map((maand) => {
      const maandPercentage = maandverdeling[maand] || 0;
      const prognoseOmzet = Math.round(maandPercentage * jaaromzet);
      const prognoseDagen = new Date(2025, maand, 0).getDate();
      const prognosePerDag = prognoseOmzet / prognoseDagen;

      const realisatie = realisatieMap[maand] || { dagen: 0, omzet: 0 };
      const realisatiePerDag = realisatie.dagen > 0 ? realisatie.omzet / realisatie.dagen : null;

      const todoOmzet = prognoseOmzet - realisatie.omzet;
      const todoDagen = Math.max(prognoseDagen - realisatie.dagen, 0);
      const todoPerDag = todoDagen > 0 ? todoOmzet / todoDagen : null;

      const prognoseHuidig = realisatie.omzet + Math.max(todoOmzet, 0);
      const plusmin = realisatie.omzet - prognoseOmzet;

      cumulatiefPlus += plusmin;
      cumulatiefPrognose += prognoseOmzet;
      cumulatiefRealisatie += realisatie.omzet;

      const voorAchterInDagen = prognosePerDag > 0 ? plusmin / prognosePerDag : null;
      const procentueel = prognoseOmzet > 0 ? plusmin / prognoseOmzet : null;

      return {
        maand,
        prognoseOmzet,
        prognoseDagen,
        prognosePerDag,

        realisatieOmzet: realisatie.omzet,
        realisatieDagen: realisatie.dagen,
        realisatiePerDag,

        todoOmzet,
        todoDagen,
        todoPerDag,

        prognoseHuidig,
        plusmin,
        cumulatiefPlus,
        cumulatiefPrognose,
        cumulatiefRealisatie,

        voorAchterInDagen,
        procentueel,
        jrPrognoseObvTotNu: cumulatiefRealisatie + (jaaromzet - cumulatiefPrognose)
      };
    });

    return NextResponse.json({ resultaten, jaaromzet });
  } catch (e) {
    console.error("Fout in analyse API:", e);
    return NextResponse.json({ error: "Fout in analyse API" }, { status: 500 });
  }
}
