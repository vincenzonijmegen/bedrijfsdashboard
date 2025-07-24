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
        SELECT m.maand, (m.omzet_maand / j.omzet_jaar)::numeric AS maand_percentage
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
    const currentYear = new Date().getFullYear();
    const realisatieRes = await db.query(
      `SELECT EXTRACT(MONTH FROM datum)::int AS maand,
              COUNT(DISTINCT datum) AS dagen,
              SUM(aantal * eenheidsprijs) AS omzet
       FROM rapportage.omzet
       WHERE EXTRACT(YEAR FROM datum)::int = $1
       GROUP BY maand
       ORDER BY maand;`,
      [currentYear]
    );

    const realisatieMap: Record<number, { dagen: number; omzet: number }> = {};
    realisatieRes.rows.forEach((r) => {
      realisatieMap[Number(r.maand)] = {
        dagen: Number(r.dagen),
        omzet: Number(r.omzet),
      };
    });

    // Stap 4: Combineer per maand (maart t/m september)
    const maanden = [3, 4, 5, 6, 7, 8, 9];
    let cumulatiefRealisatie = 0;

    const resultaten = maanden.map((maand) => {
      // Bereken prognose-omzet en dagen
      const percentage = maandverdeling[maand] || 0;
      const prognoseOmzet = Math.round(percentage * jaaromzet);
      const prognoseDagen = new Date(currentYear, maand, 0).getDate();
      const prognosePerDag = prognoseOmzet / prognoseDagen;

      // Gerealiseerde data
      const real = realisatieMap[maand] || { dagen: 0, omzet: 0 };
      const realisatiePerDag = real.dagen > 0 ? real.omzet / real.dagen : null;

      // Accumuleer gerealiseerde omzet
      cumulatiefRealisatie += real.omzet;

      // Bereken forecast voor resterende maanden
      const forecastRest = maanden.reduce((sum, m2) => {
        if (m2 === maand) {
          // resterende dagen van huidige maand
          const todoDagen = Math.max(prognoseDagen - real.dagen, 0);
          return sum + Math.round(prognosePerDag * todoDagen);
        } else if (m2 > maand) {
          // volledige prognose van toekomstige maand
          const fullForecast = Math.round((maandverdeling[m2] || 0) * jaaromzet);
          return sum + fullForecast;
        }
        return sum;
      }, 0);

      // JrPrognose obv omzet to date = gerealiseerd + forecastRest
      const jrPrognoseObvTotNu = cumulatiefRealisatie + forecastRest;

      // Overige kolommen
      const todoOmzet = prognoseOmzet - real.omzet;
      const todoDagen = Math.max(prognoseDagen - real.dagen, 0);
      const todoPerDag = todoDagen > 0 ? todoOmzet / todoDagen : null;
      const plusmin = (realisatiePerDag !== null ? realisatiePerDag * prognoseDagen : 0) - prognoseOmzet;
      const voorAchterInDagen = prognosePerDag > 0 ? plusmin / prognosePerDag : null;
      const procentueel = prognoseOmzet > 0 ? plusmin / prognoseOmzet : null;

      return {
        maand,
        prognoseOmzet,
        prognoseDagen,
        prognosePerDag,
        realisatieOmzet: real.omzet,
        realisatieDagen: real.dagen,
        realisatiePerDag,
        todoOmzet,
        todoDagen,
        todoPerDag,
        prognoseHuidig: realisatiePerDag !== null ? realisatiePerDag * prognoseDagen : 0,
        plusmin,
        cumulatiefPlus: 0,
        cumulatiefPrognose: 0,
        cumulatiefRealisatie,
        voorAchterInDagen,
        procentueel,
        jrPrognoseObvTotNu,
      };
    });

    return NextResponse.json({ resultaten, jaaromzet });
  } catch (e) {
    console.error("Fout in analyse API:", e);
    return NextResponse.json({ error: "Fout in analyse API" }, { status: 500 });
  }
}
