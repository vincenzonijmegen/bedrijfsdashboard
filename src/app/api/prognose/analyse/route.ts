import { NextResponse } from "next/server";
import { dbRapportage as db } from "@/lib/dbRapportage";

const MAANDEN = [3, 4, 5, 6, 7, 8, 9];
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const now = new Date();
  const jaar = Number(url.searchParams.get("jaar") ?? now.getFullYear());
  const vorigJaar = jaar - 1;

  try {
    // 1) Vorig jaar totaal
    const vorigJaarOmzetRes = await db.query(
      `SELECT COALESCE(SUM(aantal * eenheidsprijs), 0) AS totaal
       FROM rapportage.omzet
       WHERE EXTRACT(YEAR FROM datum)::int = $1`,
      [vorigJaar]
    );
    const vorigJaarOmzet = Number(vorigJaarOmzetRes.rows?.[0]?.totaal || 0);
    const jaaromzet = Math.round(vorigJaarOmzet * 1.03);

    // 2) Pct per maand (op basis van klassieke omzet 2022-2024)
    const pctMap = new Map<number, number>();
    const pctRes = await db.query(`
      WITH bron AS (
        SELECT EXTRACT(YEAR FROM datum)::int AS yr,
               EXTRACT(MONTH FROM datum)::int AS m,
               (aantal * eenheidsprijs) AS omz
        FROM rapportage.omzet
        WHERE EXTRACT(YEAR FROM datum)::int BETWEEN 2022 AND 2024
          AND EXTRACT(MONTH FROM datum)::int BETWEEN 3 AND 9
      ), pjm AS (
        SELECT yr, m, SUM(omz) AS omz FROM bron GROUP BY 1, 2
      ), pjt AS (
        SELECT yr, SUM(omz) AS jaar_omz FROM pjm GROUP BY 1
      )
      SELECT m, COALESCE(AVG(CASE WHEN pjt.jaar_omz > 0 THEN pjm.omz / pjt.jaar_omz ELSE 0 END), 0) AS pct
      FROM pjm JOIN pjt ON pjt.yr = pjm.yr
      GROUP BY m ORDER BY m
    `);
    for (const r of pctRes.rows ?? []) pctMap.set(Number(r.m), Number(r.pct) || 0);
    for (const m of MAANDEN) if (!pctMap.has(m)) pctMap.set(m, 0);
    if (MAANDEN.every(m => (pctMap.get(m) || 0) === 0)) {
      const g = 1 / MAANDEN.length;
      MAANDEN.forEach(m => pctMap.set(m, g));
    }

    // 3) Realisatie huidig jaar (dagtellingen uit klassieke omzet)
    const realByMonth = new Map<number, { omz: number; dagen: number }>();
    const realRaw = await db.query(`
      WITH bron AS (
        SELECT EXTRACT(MONTH FROM datum)::int AS m,
               datum::date AS d,
               (aantal * eenheidsprijs) AS omz
        FROM rapportage.omzet
        WHERE EXTRACT(YEAR FROM datum)::int = $1
          AND EXTRACT(MONTH FROM datum)::int BETWEEN 3 AND 9
      ), per_dag AS (
        SELECT m, d, SUM(omz) AS omz FROM bron GROUP BY 1, 2
      )
      SELECT m, SUM(omz) AS omz, COUNT(*) AS dagen
      FROM per_dag GROUP BY 1 ORDER BY 1
    `, [jaar]);
    for (const r of realRaw.rows ?? []) {
      realByMonth.set(Number(r.m), {
        omz: Number(r.omz) || 0,
        dagen: Number(r.dagen) || 0
      });
    }

    // 4) Prognose-dagen
    const progDays = new Map<number, number>();
    const progQ = await db.query(
      `SELECT maand::int AS m, COALESCE(dagen,0)::int AS d
       FROM rapportage.omzetdagen
       WHERE jaar = $1 AND maand BETWEEN 3 AND 9
       ORDER BY maand`,
      [jaar]
    );
    for (const r of progQ.rows ?? []) {
      progDays.set(Number(r.m), Number(r.d) || 0);
    }
    if ((progQ.rows ?? []).length === 0) {
      for (const m of MAANDEN) progDays.set(m, daysInMonth(jaar, m));
    } else {
      for (const m of MAANDEN) if (!progDays.has(m)) progDays.set(m, 0);
    }

    // 5) Maanddata opbouwen
    const data = MAANDEN.map((m) => {
      const pct = pctMap.get(m) || 0;
      const prognoseOmzet = Math.round(jaaromzet * pct);
      const prognoseDagen = progDays.get(m) ?? daysInMonth(jaar, m);
      const real = realByMonth.get(m);
      const realisatieOmzet = real?.omz ?? 0;
      const realisatieDagen = real?.dagen ?? 0;
      const prognosePerDag = prognoseDagen > 0 ? Math.round(prognoseOmzet / prognoseDagen) : 0;
      const realisatiePerDag = realisatieDagen > 0 ? Math.round(realisatieOmzet / realisatieDagen) : null;
      const todoOmzet = prognoseOmzet - realisatieOmzet;
      const todoDagen = Math.max(prognoseDagen - realisatieDagen, 0);
      const todoPerDag = todoDagen > 0 ? Math.round(todoOmzet / todoDagen) : null;
      const verwachtTotNu = prognoseDagen > 0 ? (prognoseOmzet * (realisatieDagen / prognoseDagen)) : 0;
      const plusmin = Math.round(realisatieOmzet - verwachtTotNu);
      const prognoseHuidig = realisatieOmzet + Math.max(prognoseOmzet - realisatieOmzet, 0);
      const voorAchterInDagen = prognosePerDag > 0 ? Number(((realisatieOmzet / prognosePerDag) - realisatieDagen).toFixed(1)) : null;
      const procentueel = prognoseOmzet > 0 ? Number(((realisatieOmzet / prognoseOmzet) * 100).toFixed(1)) : null;
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
        cumulatiefPlus: 0,
        cumulatiefPrognose: 0,
        cumulatiefRealisatie: 0,
        voorAchterInDagen,
        procentueel,
        jrPrognoseObvTotNu: 0,
      };
    });

    // 6) Cumulatieven + jaarprojectie obv tot-nu
    let cumP = 0, cumR = 0, cumPlus = 0;
    for (const r of data) {
      cumP += r.prognoseOmzet;
      cumR += r.realisatieOmzet;
      cumPlus += r.plusmin;
      r.cumulatiefPrognose = cumP;
      r.cumulatiefRealisatie = cumR;
      r.cumulatiefPlus = cumPlus;
    }
    const totNuPrognose = data.filter(r => r.realisatieDagen > 0).reduce((s,r)=>s+r.prognoseOmzet,0);
    const totNuRealisatie = data.filter(r => r.realisatieDagen > 0).reduce((s,r)=>s+r.realisatieOmzet,0);
    const factor = totNuPrognose > 0 ? (totNuRealisatie / totNuPrognose) : 0;
    const jaarProjObvTotNu = Math.round(jaaromzet * factor);
    data.forEach(r => (r.jrPrognoseObvTotNu = jaarProjObvTotNu));

    return NextResponse.json(
      { jaar, vorigJaar, vorigJaarOmzet, jaaromzet, resultaten: data },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("[/api/prognose/analyse] error:", err?.message ?? err);
    return NextResponse.json(
      { error: "Serverfout in prognose/analyse", detail: String(err?.message ?? err) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
