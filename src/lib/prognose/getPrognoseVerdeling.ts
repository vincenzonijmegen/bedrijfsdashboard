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
 * Bron: alle volledig afgesloten omzetjaren vanaf 2022.
 * Voor een historisch doeljaar worden alleen jaren vóór dat doeljaar gebruikt;
 * voor het huidige of een toekomstig doeljaar nooit het nog onvolledige huidige jaar.
 */
export async function getPrognoseVerdeling(
  doelJaar = new Date().getFullYear()
): Promise<PrognoseVerdelingModel> {
  const huidigJaar = new Date().getFullYear();
  const grensJaar = Math.min(doelJaar, huidigJaar);

  const result = await db.query(
    `
      WITH geldige_jaren AS (
        SELECT DISTINCT EXTRACT(YEAR FROM datum)::int AS jaar
        FROM rapportage.omzet
        WHERE EXTRACT(YEAR FROM datum)::int >= 2022
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
        SELECT jaar, SUM(omzet_maand) AS omzet_jaar
        FROM maandomzet
        GROUP BY jaar
      ),
      verdeling AS (
        SELECT
          m.jaar,
          m.maand,
          CASE
            WHEN j.omzet_jaar > 0 THEN m.omzet_maand / j.omzet_jaar
            ELSE 0
          END AS maand_percentage
        FROM maandomzet m
        JOIN jaaromzet j ON j.jaar = m.jaar
      )
      SELECT
        v.maand,
        ROUND(AVG(v.maand_percentage)::numeric, 8) AS percentage,
        (SELECT COUNT(*)::int FROM geldige_jaren) AS aantal_jaren,
        COALESCE(
          (SELECT ARRAY_AGG(jaar ORDER BY jaar) FROM geldige_jaren),
          ARRAY[]::int[]
        ) AS bron_jaren
      FROM verdeling v
      GROUP BY v.maand
      ORDER BY v.maand
    `,
    [grensJaar]
  );

  const eerste = result.rows?.[0];
  return {
    jaren: Number(eerste?.aantal_jaren ?? 0),
    bronJaren: Array.isArray(eerste?.bron_jaren)
      ? eerste.bron_jaren.map((jaar: unknown) => Number(jaar))
      : [],
    verdeling: (result.rows ?? []).map((r: any) => ({
      maand: Number(r.maand),
      percentage: Number(r.percentage) || 0,
    })),
  };
}

/**
 * Gebruikers van een seizoensmodel kunnen dezelfde centrale verdeling nemen
 * en die binnen hun actieve maanden normaliseren. De onderlinge verhouding
 * blijft exact die van /api/prognose/verdeling.
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
