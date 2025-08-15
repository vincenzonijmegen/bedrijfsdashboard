// src/app/api/prognose/analyse/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type MaandData = {
  maand: number; // 3..9
  prognoseOmzet: number;
  prognoseDagen: number;
  prognosePerDag: number;
  realisatieOmzet: number;
  realisatieDagen: number;
  realisatiePerDag: number | null;
  todoOmzet: number;
  todoDagen: number;
  todoPerDag: number | null;
  prognoseHuidig: number;
  plusmin: number;
  cumulatiefPlus: number;
  cumulatiefPrognose: number;
  cumulatiefRealisatie: number;
  voorAchterInDagen: number | null;
  procentueel: number | null;
  jrPrognoseObvTotNu: number;
};

const MAANDEN = [3, 4, 5, 6, 7, 8, 9];

/** hulpje: # kalenderdagen in maand */
function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate(); // m is 1..12
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const now = new Date();
    const jaar = Number(url.searchParams.get("jaar") ?? now.getFullYear());
    const vorigJaar = jaar - 1;

    // 1) VORIG JAAR OMZET
    const vorigJaarOmzetRes = await db.query(
      `
      SELECT COALESCE(SUM(aantal * eenheidsprijs), 0) AS totaal
      FROM rapportage.omzet
      WHERE EXTRACT(YEAR FROM datum)::int = $1
      `,
      [vorigJaar]
    );
    const vorigJaarOmzet = Number(vorigJaarOmzetRes.rows?.[0]?.totaal || 0);

    // Jaaromzet = vorig jaar * 1,03
    const jaaromzet = Math.round(vorigJaarOmzet * 1.03);

    // 2) GEMIDDELDE MAANDPERCENTAGES op basis van 2022–2024 (alleen maanden 3..9)
    const pctRes = await db.query(`
      WITH bron AS (
        SELECT
          EXTRACT(YEAR  FROM datum)::int AS yr,
          EXTRACT(MONTH FROM datum)::int AS m,
          (aantal * eenheidsprijs)       AS omz
        FROM rapportage.omzet
        WHERE EXTRACT(YEAR FROM datum)::int BETWEEN 2022 AND 2024
          AND EXTRACT(MONTH FROM datum)::int BETWEEN 3 AND 9
      ),
      per_jaar_maand AS (
        SELECT yr, m, COALESCE(SUM(omz),0) AS omz
        FROM bron
        GROUP BY 1,2
      ),
      per_jaar_totaal AS (
        SELECT yr, COALESCE(SUM(omz),0) AS jaar_omz
        FROM per_jaar_maand
        GROUP BY 1
      ),
      pct AS (
        SELECT p.yr, p.m, 
               CASE WHEN t.jaar_omz > 0 THEN p.omz / t.jaar_omz ELSE 0 END AS pct
        FROM per_jaar_maand p
        JOIN per_jaar_totaal t ON t.yr = p.yr
      )
      SELECT m, COALESCE(AVG(pct),0) AS avg_pct
      FROM pct
      GROUP BY m
    `);

    const avgPctByMonth = new Map<number, number>();
    for (const row of pctRes.rows || []) {
      avgPctByMonth.set(Number(row.m), Number(row.avg_pct));
    }

    // fallback: als alle pct's 0 zijn, verdeel gelijk over 7 maanden
    const allePctNul = MAANDEN.every((m) => (avgPctByMonth.get(m) || 0) === 0);
    if (allePctNul) {
      const gelijk = 1 / MAANDEN.length;
      MAANDEN.forEach((m) => avgPctByMonth.set(m, gelijk));
    }

    // 3) REALISATIE huidig geselecteerd jaar (maand 3..9):
    //    - omzet per maand
    //    - aantal dagen met omzet (distinct datum)
    const realRes = await db.query(
      `
      WITH bron AS (
        SELECT
          EXTRACT(MONTH FROM datum)::int AS m,
          datum::date                     AS d,
          (aantal * eenheidsprijs)        AS omz
        FROM rapportage.omzet
        WHERE EXTRACT(YEAR FROM datum)::int = $1
          AND EXTRACT(MONTH FROM datum)::int BETWEEN 3 AND 9
      ),
      per_dag AS (
        SELECT m, d, COALESCE(SUM(omz),0) AS omz
        FROM bron
        GROUP BY 1,2
      ),
      per_maand AS (
        SELECT m,
               COALESCE(SUM(omz),0)                    AS omz,
               COUNT(*)                                AS dagen_met_omzet
        FROM per_dag
        GROUP BY 1
      )
      SELECT m, omz, dagen_met_omzet
      FROM per_maand
      `,
      [jaar]
    );

    const realByMonth = new Map<
      number,
      { omz: number; dagen_met_omzet: number }
    >();
    for (const r of realRes.rows || []) {
      realByMonth.set(Number(r.m), {
        omz: Number(r.omz) || 0,
        dagen_met_omzet: Number(r.dagen_met_omzet) || 0,
      });
    }

    // 4) Bouw MaandData + berekeningen
    // PrognoseDagen = # kalenderdagen in maand (je kunt dit vervangen door "geplande open dagen" als je die hebt)
    const resultaten: MaandData[] = MAANDEN.map((m) => {
      const pct = avgPctByMonth.get(m) ?? 0;
      const prognoseOmzet = Math.round(jaaromzet * pct);
      const prognoseDagen = daysInMonth(jaar, m);
      const prognosePerDag = prognoseDagen > 0 ? Math.round(prognoseOmzet / prognoseDagen) : 0;

      const real = realByMonth.get(m);
      const realisatieOmzet = real?.omz ?? 0;
      const realisatieDagen = real?.dagen_met_omzet ?? 0;
      const realisatiePerDag =
        realisatieDagen > 0 ? Math.round(realisatieOmzet / realisatieDagen) : null;

      const todoOmzet = Math.max(prognoseOmzet - realisatieOmzet, 0);
      const todoDagen = Math.max(prognoseDagen - realisatieDagen, 0);
      const todoPerDag = todoDagen > 0 ? Math.round(todoOmzet / todoDagen) : null;

      // "verwacht tot nu" obv dagverdeling (lineair over maand)
      const verwachtTotNu =
        prognoseDagen > 0 ? (prognoseOmzet * (realisatieDagen / prognoseDagen)) : 0;

      // plusmin: verschil t.o.v. verwacht tot nu
      const plusmin = Math.round(realisatieOmzet - verwachtTotNu);

      // prognoseHuidig: realisatie + resterend = prognoseOmzet (lineair)
      const prognoseHuidig = realisatieOmzet + todoOmzet; // == prognoseOmzet

      // voor/achter in dagen: hoeveel dagen "voor/achter" t.o.v. target-ritme
      const voorAchterInDagen = prognosePerDag > 0
        ? Number(((realisatieOmzet / prognosePerDag) - realisatieDagen).toFixed(1))
        : null;

      const procentueel =
        prognoseOmzet > 0 ? Number(((realisatieOmzet / prognoseOmzet) * 100).toFixed(1)) : null;

      return {
        maand: m,
        prognoseOmzet,
        prognoseDagen,
        prognosePerDag,
        realisatieOmzet,
        realisatieDagen,
        realisatiePerDag,
        todoOmzet,
        todoDagen,
        todoPerDag,
        prognoseHuidig,
        plusmin,
        cumulatiefPlus: 0, // vullen we hieronder
        cumulatiefPrognose: 0,
        cumulatiefRealisatie: 0,
        voorAchterInDagen,
        procentueel,
        jrPrognoseObvTotNu: 0, // vullen we hieronder
      };
    });

    // 5) Cumulatieven + jaarprojectie obv tot-nu toe
    let cumPrognose = 0;
    let cumRealisatie = 0;
    let cumPlus = 0;

    for (const r of resultaten) {
      cumPrognose += r.prognoseOmzet;
      cumRealisatie += r.realisatieOmzet;
      cumPlus += r.plusmin;

      r.cumulatiefPrognose = cumPrognose;
      r.cumulatiefRealisatie = cumRealisatie;
      r.cumulatiefPlus = cumPlus;
    }

    // Jaarprojectie obv tot-nu toe (alle maanden 3..9 met realisatieDagen > 0)
    const totNuPrognose = resultaten
      .filter((r) => r.realisatieDagen > 0)
      .reduce((s, r) => s + r.prognoseOmzet, 0);
    const totNuRealisatie = resultaten
      .filter((r) => r.realisatieDagen > 0)
      .reduce((s, r) => s + r.realisatieOmzet, 0);

    const factor = totNuPrognose > 0 ? totNuRealisatie / totNuPrognose : 0;
    const jaarProjObvTotNu = Math.round(jaaromzet * (factor || 0));

    // vul jrPrognoseObvTotNu per rij met dezelfde waarde (zoals je UI verwacht)
    resultaten.forEach((r) => (r.jrPrognoseObvTotNu = jaarProjObvTotNu));

    return NextResponse.json(
      {
        jaar,
        vorigJaar,
        vorigJaarOmzet,
        jaaromzet,
        resultaten,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    // Veilige default: lege set
    return NextResponse.json(
      { jaaromzet: 0, vorigJaarOmzet: 0, resultaten: [] },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
