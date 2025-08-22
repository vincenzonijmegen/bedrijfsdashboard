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
  todoOmzet: number;        // ✅ gesigneerd
  todoDagen: number;        // blijft 0-floor
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

function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate(); // m: 1..12
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const now = new Date();
    const jaar = Number(url.searchParams.get("jaar") ?? now.getFullYear());
    const vorigJaar = jaar - 1;

    // 1) Vorig jaar omzet
    const vorigJaarOmzetRes = await db.query(
      `SELECT COALESCE(SUM(totaal), 0) AS totaal
        FROM rapportage.omzet_maand
        WHERE jaar = $1`,
      [vorigJaar]
    );
    const vorigJaarOmzet = Number(vorigJaarOmzetRes.rows?.[0]?.totaal || 0);

    // Jaaromzet = vorig jaar * 1,03
    const jaaromzet = Math.round(vorigJaarOmzet * 1.03);

    // 2) Gemiddelde maandpercentages 2022–2024 (alleen maanden 3..9)
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
    // fallback: gelijk verdelen als alle pct's 0 zijn
    if (MAANDEN.every((m) => (avgPctByMonth.get(m) || 0) === 0)) {
      const gelijk = 1 / MAANDEN.length;
      MAANDEN.forEach((m) => avgPctByMonth.set(m, gelijk));
    }

    // 3) Realisatie huidig jaar (maanden 3..9): omzet + dagen_met_omzet
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
               COALESCE(SUM(omz),0) AS omz,
               COUNT(*)             AS dagen_met_omzet
        FROM per_dag
        GROUP BY 1
      )
      SELECT m, omz, dagen_met_omzet
      FROM per_maand
      `,
      [jaar]
    );
    const realByMonth = new Map<number, { omz: number; dagen_met_omzet: number }>();
    for (const r of realRes.rows || []) {
      realByMonth.set(Number(r.m), {
        omz: Number(r.omz) || 0,
        dagen_met_omzet: Number(r.dagen_met_omzet) || 0,
      });
    }

    // 4) PrognoseDagen uit tabel rapportage.omzetdagen (jaar + maand 3..9)
    const dagenRes = await db.query(
      `
      SELECT maand, COALESCE(dagen,0) AS dagen
      FROM rapportage.omzetdagen
      WHERE jaar = $1 AND maand BETWEEN 3 AND 9
      ORDER BY maand
      `,
      [jaar]
    );
    const prognoseDagenMap = new Map<number, number>();
    for (const row of dagenRes.rows || []) {
      prognoseDagenMap.set(Number(row.maand), Number(row.dagen) || 0);
    }

    // 5) Bouw MaandData (met fixes)
    const resultaten: MaandData[] = MAANDEN.map((m) => {
      const pct = avgPctByMonth.get(m) ?? 0;
      const prognoseOmzet = Math.round(jaaromzet * pct);

      // ✅ prognoseDagen uit omzetdagen, fallback op kalenderdagen
      const prognoseDagen = prognoseDagenMap.get(m) ?? daysInMonth(jaar, m);

      const real = realByMonth.get(m);
      const realisatieOmzet = real?.omz ?? 0;
      const realisatieDagen = real?.dagen_met_omzet ?? 0;

      const prognosePerDag = prognoseDagen > 0 ? Math.round(prognoseOmzet / prognoseDagen) : 0;
      const realisatiePerDag =
        realisatieDagen > 0 ? Math.round(realisatieOmzet / realisatieDagen) : null;

      // ✅ To‑do omzet gesigneerd (geen max 0)
      const todoOmzet = prognoseOmzet - realisatieOmzet;

      // To‑do dagen: houden we 0-floor
      const todoDagen = Math.max(prognoseDagen - realisatieDagen, 0);
      const todoPerDag = todoDagen > 0 ? Math.round(todoOmzet / todoDagen) : null;

      // Verwacht tot nu (lineair over maand) voor plusmin
      const verwachtTotNu = prognoseDagen > 0
        ? (prognoseOmzet * (realisatieDagen / prognoseDagen))
        : 0;
      const plusmin = Math.round(realisatieOmzet - verwachtTotNu);

      // prognoseHuidig = realisatie + resterend = prognose (lineair)
      const prognoseHuidig = realisatieOmzet + Math.max(prognoseOmzet - realisatieOmzet, 0);

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
        todoOmzet,       // ✅ gesigneerd
        todoDagen,       // 0-floor
        todoPerDag,
        prognoseHuidig,
        plusmin,
        cumulatiefPlus: 0,
        cumulatiefPrognose: 0,
        cumulatiefRealisatie: 0,
        voorAchterInDagen,
        procentueel,
        jrPrognoseObvTotNu: 0,
      };
    });

    // 6) Cumulatieven en jaarprojectie obv tot nu
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

    const totNuPrognose = resultaten
      .filter((r) => r.realisatieDagen > 0)
      .reduce((s, r) => s + r.prognoseOmzet, 0);
    const totNuRealisatie = resultaten
      .filter((r) => r.realisatieDagen > 0)
      .reduce((s, r) => s + r.realisatieOmzet, 0);
    const factor = totNuPrognose > 0 ? totNuRealisatie / totNuPrognose : 0;
    const jaarProjObvTotNu = Math.round(jaaromzet * (factor || 0));
    resultaten.forEach((r) => (r.jrPrognoseObvTotNu = jaarProjObvTotNu));

    return NextResponse.json(
      { jaar, vorigJaar, vorigJaarOmzet, jaaromzet, resultaten },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { jaaromzet: 0, vorigJaarOmzet: 0, resultaten: [] },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
