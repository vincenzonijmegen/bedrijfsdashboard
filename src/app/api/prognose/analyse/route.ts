// src/app/api/prognose/analyse/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // ✅ Nieuw: jaar via query, default = huidig
    const now = new Date();
    const jaar = Number(url.searchParams.get("jaar") ?? now.getFullYear());
    const maandVandag = now.getMonth() + 1; // 1..12 (alleen gebruiken als je 'tot nu' nodig hebt)
    const vorigJaar = jaar - 1;

    /**
     * -- Vanaf hier gebruik je 'jaar' en 'vorigJaar' in plaats van hardcoded 'currentYear'.
     * -- Voorbeeld (pas jouw eigen queries aan, niets anders hoeft te wijzigen):
     */

    // (Voorbeeld) omzet vorig jaar ophalen
    const vorigJaarOmzetRes = await db.query(
      `SELECT SUM(aantal * eenheidsprijs) AS totaal
       FROM rapportage.omzet
       WHERE EXTRACT(YEAR FROM datum)::int = $1`,
      [vorigJaar]
    );
    const vorigJaarOmzet = Number(vorigJaarOmzetRes.rows[0]?.totaal || 0);

    // Jaaromzet (prognose-basis) = vorig jaar * 1.03 (zoals je eerder bepaald had)
    const jaaromzet = Math.round(vorigJaarOmzet * 1.03);

    /**
     * -- Hier roep je je bestaande berekeningen/queries aan om de 'resultaten' array te bouwen
     * -- voor maanden 3..9 van het gekozen 'jaar'.
     * -- Laat je bestaande CTE’s / joins staan, maar filter overal op $1 = 'jaar' i.p.v. currentYear.
     */

    const resultatenRes = await db.query(
      `
      -- Vervang dit door je eigen bestaande query die de MaandData velden oplevert.
      -- Hieronder staat een minimale placeholder die alleen de maanden teruggeeft,
      -- zodat de route altijd een geldige shape heeft. Vul jouw echte berekeningen in.
      SELECT m AS maand,
             0::numeric AS prognose_omzet,
             0::numeric AS prognose_dagen,
             0::numeric AS prognose_per_dag,
             0::numeric AS realisatie_omzet,
             0::numeric AS realisatie_dagen,
             NULL::numeric AS realisatie_per_dag,
             0::numeric AS todo_omzet,
             0::numeric AS todo_dagen,
             NULL::numeric AS todo_per_dag,
             0::numeric AS prognose_huidig,
             0::numeric AS plusmin,
             0::numeric AS cumulatief_plus,
             0::numeric AS cumulatief_prognose,
             0::numeric AS cumulatief_realisatie,
             NULL::numeric AS voor_achter_in_dagen,
             NULL::numeric AS procentueel,
             0::numeric AS jr_prognose_obv_totnu
      FROM (VALUES (3),(4),(5),(6),(7),(8),(9)) AS v(m)
      ORDER BY 1
      `
    );

    const resultaten = (resultatenRes.rows ?? []).map((r: any) => ({
      maand: Number(r.maand),
      prognoseOmzet: Number(r.prognose_omzet),
      prognoseDagen: Number(r.prognose_dagen),
      prognosePerDag: Number(r.prognose_per_dag),
      realisatieOmzet: Number(r.realisatie_omzet),
      realisatieDagen: Number(r.realisatie_dagen),
      realisatiePerDag: r.realisatie_per_dag === null ? null : Number(r.realisatie_per_dag),
      todoOmzet: Number(r.todo_omzet),
      todoDagen: Number(r.todo_dagen),
      todoPerDag: r.todo_per_dag === null ? null : Number(r.todo_per_dag),
      prognoseHuidig: Number(r.prognose_huidig),
      plusmin: Number(r.plusmin),
      cumulatiefPlus: Number(r.cumulatief_plus),
      cumulatiefPrognose: Number(r.cumulatief_prognose),
      cumulatiefRealisatie: Number(r.cumulatief_realisatie),
      voorAchterInDagen: r.voor_achter_in_dagen === null ? null : Number(r.voor_achter_in_dagen),
      procentueel: r.procentueel === null ? null : Number(r.procentueel),
      jrPrognoseObvTotNu: Number(r.jr_prognose_obv_totnu),
    }));

    return NextResponse.json({
      jaar,
      vorigJaar,
      vorigJaarOmzet,
      jaaromzet,
      resultaten,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { jaaromzet: 0, vorigJaarOmzet: 0, resultaten: [] },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
