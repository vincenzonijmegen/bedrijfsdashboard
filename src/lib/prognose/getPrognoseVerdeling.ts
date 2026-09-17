import { dbRapportage as db } from "@/lib/dbRapportage";

export type PrognoseVerdelingRegel = {
  maand: number;
  percentage: number;
};

export type PrognoseVerdelingModel = {
  jaren: number;
  bronJaren: number[];
  verdeling: PrognoseVerdelingRegel[];
};

/**
 * Centrale maandverdeling voor omzetprognoses.
 *
 * Gebruikt bewust dezelfde querylogica als de oorspronkelijke,
 * werkende /api/prognose/verdeling-route: alle volledig afgesloten
 * omzetjaren vanaf 2022 tot het huidige jaar.
 *
 * Alle gebruikers (rapportage, cashflow en shiftprognose) delen deze
 * functie, zodat de maandverdeling nog maar op één plek wordt bepaald.
 */
export async function getPrognoseVerdeling(
  _doelJaar = new Date().getFullYear()
): Promise<PrognoseVerdelingModel> {
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

  const bronJarenResult = await db.query(`
    SELECT DISTINCT EXTRACT(YEAR FROM datum)::int AS jaar
    FROM rapportage.omzet
    WHERE datum >= '2022-01-01'
      AND EXTRACT(YEAR FROM datum)::int < EXTRACT(YEAR FROM CURRENT_DATE)::int
    ORDER BY jaar;
  `);

  return {
    jaren: Number(result.rows?.[0]?.aantal_jaren ?? 0),
    bronJaren: (bronJarenResult.rows ?? []).map((r: any) => Number(r.jaar)),
    verdeling: (result.rows ?? []).map((r: any) => ({
      maand: Number(r.maand),
      percentage: Number(r.percentage) || 0,
    })),
  };
}

/**
 * Normaliseert de centrale verdeling binnen de actieve maanden van een
 * seizoensmodel. De onderlinge verhouding blijft gelijk aan
 * /api/prognose/verdeling.
 */
export function normaliseerPrognoseVerdeling(
  verdeling: PrognoseVerdelingRegel[],
  maanden: number[]
): Map<number, number> {
  const bron = new Map<number, number>();
  for (const regel of verdeling) {
    bron.set(regel.maand, Number(regel.percentage) || 0);
  }

  const totaal = maanden.reduce((som, maand) => som + (bron.get(maand) || 0), 0);
  const resultaat = new Map<number, number>();

  if (totaal > 0) {
    for (const maand of maanden) {
      resultaat.set(maand, (bron.get(maand) || 0) / totaal);
    }
    return resultaat;
  }

  const gelijk = maanden.length > 0 ? 1 / maanden.length : 0;
  for (const maand of maanden) resultaat.set(maand, gelijk);
  return resultaat;
}
