// src/app/api/prognose/analyse/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Bepaal huidig jaar en maand
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    // Stap 1: Bepaal omzet vorig jaar
    const vorigJaar = currentYear - 1;
    const vorigJaarOmzetRes = await db.query(
      `SELECT SUM(aantal * eenheidsprijs) AS totaal
       FROM rapportage.omzet
       WHERE EXTRACT(YEAR FROM datum)::int = $1`,
      [vorigJaar]
    );
    const vorigJaarOmzet = Number(vorigJaarOmzetRes.rows[0]?.totaal || 0);
    const jaaromzet = Math.round(vorigJaarOmzet * 1.03);

    // Stap 2: Haal gemiddelde maandpercentages
    const verdelingRes = await db.query(`
      WITH geldige_jaren AS (
        SELECT DISTINCT EXTRACT(YEAR FROM datum)::int AS jaar
        FROM rapportage.omzet
        WHERE datum >= '2022-01-01'
          AND EXTRACT(YEAR FROM datum)::int < $1
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
    `, [currentYear]);
    const maandverdeling: Record<number, number> = {};
    verdelingRes.rows.forEach(r => {
      maandverdeling[Number(r.maand)] = Number(r.percentage);
    });

    // Stap 3: Haal realisatie per maand
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
    realisatieRes.rows.forEach(r => {
      realisatieMap[Number(r.maand)] = { dagen: Number(r.dagen), omzet: Number(r.omzet) };
    });

    // Stap 4: Combineer voor maanden maart t/m september
    const maanden = [3,4,5,6,7,8,9];
    let cumulatiefRealisatie = 0;
    let baseJaarPrognose = 0;

    const resultaten = maanden.map(maand => {
      // Bereken prognose-omzet
      const pct = maandverdeling[maand] || 0;
      const prognoseOmzet = Math.round(pct * jaaromzet);
      const prognoseDagen = new Date(currentYear, maand, 0).getDate();
      const prognosePerDag = prognoseOmzet / prognoseDagen;

      // Realtime data
      const real = realisatieMap[maand] || { dagen: 0, omzet: 0 };
      const realisatiePerDag = real.dagen > 0 ? real.omzet / real.dagen : null;
      cumulatiefRealisatie += real.omzet;

      // Forecast voor rest
      let forecastRest = 0;
      maanden.forEach(m2 => {
        if (m2 === maand) {
          const todoDagen = Math.max(prognoseDagen - real.dagen, 0);
          forecastRest += Math.round(prognosePerDag * todoDagen);
        } else if (m2 > maand) {
          forecastRest += Math.round((maandverdeling[m2] || 0) * jaaromzet);
        }
      });

      // Bereken jaarprognose obv tot nu
      const jrPrg = cumulatiefRealisatie + forecastRest;
      if (maand === currentMonth) baseJaarPrognose = jrPrg;
      const jrPrgDisplay = maand >= currentMonth ? baseJaarPrognose : jrPrg;

      return {
        maand,
        prognoseOmzet,
        prognoseDagen,
        prognosePerDag,
        realisatieOmzet: real.omzet,
        realisatieDagen: real.dagen,
        realisatiePerDag,
        todoOmzet: prognoseOmzet - real.omzet,
        todoDagen: Math.max(prognoseDagen - real.dagen, 0),
        todoPerDag: realisatiePerDag !== null ? (prognoseOmzet - real.omzet) / Math.max(prognoseDagen - real.dagen,1) : null,
        prognoseHuidig: realisatiePerDag !== null ? realisatiePerDag * prognoseDagen : 0,
        plusmin: (realisatiePerDag!==null ? realisatiePerDag*prognoseDagen:0) - prognoseOmzet,
        cumulatiefPlus:0,
        cumulatiefPrognose:0,
        cumulatiefRealisatie,
        voorAchterInDagen: prognosePerDag>0 ? ((realisatiePerDag!==null?realisatiePerDag*prognoseDagen:0)-prognoseOmzet)/prognosePerDag : null,
        procentueel: prognoseOmzet>0 ? ((realisatiePerDag!==null?realisatiePerDag*prognoseDagen:0)-prognoseOmzet)/prognoseOmzet : null,
        jrPrognoseObvTotNu: jrPrgDisplay
      };
    });

    return NextResponse.json({ resultaten, jaaromzet, vorigJaarOmzet });
  } catch(e) {
    console.error("Fout in analyse API:", e);
    return NextResponse.json({ error: "Fout in analyse API" }, { status: 500 });
  }
}
