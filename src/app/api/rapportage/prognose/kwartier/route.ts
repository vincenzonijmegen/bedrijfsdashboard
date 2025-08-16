// src/app/api/rapportage/prognose/kwartier/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbRapportage } from '@/lib/dbRapportage';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jaarParam = searchParams.get('jaar');
    const groeiParam = searchParams.get('groei');
    const startParam = searchParams.get('start');
    const eindeParam = searchParams.get('einde');

    const now = new Date();
    const targetYear = jaarParam ? parseInt(jaarParam, 10) : now.getFullYear();
    const groei = groeiParam ? Number(groeiParam) : 1.03;

    const sql = `
      WITH
      -- Dagomzet uit historie (kwartiertabel)
      hist_day AS (
        SELECT
          k.datum::date AS datum,
          EXTRACT(MONTH FROM k.datum)::int AS maand,
          CASE WHEN EXTRACT(ISODOW FROM k.datum) IN (6,7) THEN 'weekend' ELSE 'week' END AS dagtype,
          SUM(k.omzet) AS dag_omzet
        FROM rapportage.omzet_kwartier k
        GROUP BY 1,2,3
      ),
      -- Maandomzet per jaar (uit kwartieren) en jaaromzet
      month_year_totals AS (
        SELECT
          EXTRACT(YEAR FROM k.datum)::int AS jaar,
          EXTRACT(MONTH FROM k.datum)::int AS maand,
          SUM(k.omzet) AS maand_omzet
        FROM rapportage.omzet_kwartier k
        GROUP BY 1,2
      ),
      year_totals AS (
        SELECT jaar, SUM(maand_omzet) AS jaar_omzet
        FROM month_year_totals
        GROUP BY 1
      ),
      -- Maand-percentage per jaar en gemiddelde maandverdeling over de jaren
      month_pct_per_year AS (
        SELECT m.jaar, m.maand,
               CASE WHEN y.jaar_omzet > 0 THEN m.maand_omzet / y.jaar_omzet ELSE 0 END AS pct
        FROM month_year_totals m
        JOIN year_totals y USING (jaar)
      ),
      month_share AS (
        SELECT maand, AVG(pct) AS maand_pct
        FROM month_pct_per_year
        GROUP BY maand
      ),
      -- Week vs weekend weging per maand o.b.v. gemiddelde dagomzet in historie
      daytype_weight AS (
        SELECT
          EXTRACT(MONTH FROM datum)::int AS maand,
          dagtype,
          AVG(dag_omzet) AS avg_dag_omzet
        FROM hist_day
        GROUP BY 1,2
      ),
      daytype_norm AS (
        SELECT
          maand, dagtype, avg_dag_omzet,
          SUM(avg_dag_omzet) OVER (PARTITION BY maand) AS sum_month
        FROM daytype_weight
      ),
      daytype_share AS (
        SELECT
          maand, dagtype,
          CASE WHEN sum_month > 0 THEN avg_dag_omzet / sum_month ELSE 0.5 END AS dagtype_pct
        FROM daytype_norm
      ),
      -- Kwartierprofiel: gemiddelde (kwartier / dag) per maand × dagtype × (uur, kwartier)
      quarter_share AS (
        SELECT
          EXTRACT(MONTH FROM k.datum)::int AS maand,
          CASE WHEN EXTRACT(ISODOW FROM k.datum) IN (6,7) THEN 'weekend' ELSE 'week' END AS dagtype,
          k.uur, k.kwartier,
          AVG( k.omzet / NULLIF(d.dag_omzet, 0) ) AS q_pct
        FROM rapportage.omzet_kwartier k
        JOIN hist_day d ON d.datum = k.datum
        GROUP BY 1,2,3,4
      ),
      -- Baseline jaaromzet = vorig jaar * groei
      params AS (
        SELECT $1::int AS target_year, $2::numeric AS groei
      ),
      baseline AS (
        SELECT COALESCE((
          SELECT SUM(aantal * eenheidsprijs)
          FROM rapportage.omzet
          WHERE EXTRACT(YEAR FROM datum)::int = (SELECT target_year - 1 FROM params)
        ), 0) AS vorigjaar
      ),
      year_target AS (
        SELECT CASE WHEN vorigjaar > 0
                    THEN ROUND(vorigjaar * (SELECT groei FROM params))
                    ELSE 0 END AS jaar_omzet
        FROM baseline
      ),
      -- Kalender voor target year
      calendar_days AS (
        SELECT
          d::date AS datum,
          EXTRACT(MONTH FROM d)::int AS maand,
          CASE WHEN EXTRACT(ISODOW FROM d) IN (6,7) THEN 'weekend' ELSE 'week' END AS dagtype
        FROM generate_series(
          make_date((SELECT target_year FROM params), 1, 1),
          make_date((SELECT target_year FROM params), 12, 31),
          interval '1 day'
        ) d
      ),
      month_day_counts AS (
        SELECT maand, dagtype, COUNT(*) AS n_days
        FROM calendar_days
        GROUP BY 1,2
      ),
      -- Verdeel maandforecast naar dagen: maand_pct × dagtype_pct / n_days
      day_share AS (
        SELECT
          c.datum, c.maand, c.dagtype,
          (SELECT maand_pct FROM month_share ms WHERE ms.maand = c.maand) AS maand_pct,
          (SELECT dagtype_pct FROM daytype_share ds WHERE ds.maand = c.maand AND ds.dagtype = c.dagtype) AS dagtype_pct,
          (SELECT n_days FROM month_day_counts mdc WHERE mdc.maand = c.maand AND mdc.dagtype = c.dagtype) AS n_days
        FROM calendar_days c
      ),
      day_forecast AS (
        SELECT
          datum, maand, dagtype,
          (SELECT jaar_omzet FROM year_target)
          * COALESCE(maand_pct, 0)
          * COALESCE(dagtype_pct, 0)
          / GREATEST(n_days, 1) AS dag_omzet_forecast
        FROM day_share
      ),
      -- Genereer kwartieren per dag volgens openingstijden-regels
      quarters AS (
        SELECT
          df.datum,
          df.maand,
          df.dagtype,
          df.dag_omzet_forecast,
          gs AS ts,
          EXTRACT(HOUR FROM gs)::int AS uur,
          (FLOOR(EXTRACT(MINUTE FROM gs)::int / 15) + 1)::int AS kwartier
        FROM day_forecast df
        CROSS JOIN LATERAL (
          SELECT generate_series(
            -- starttijd
            CASE
              WHEN df.maand = 3 THEN -- maart
                make_timestamp(EXTRACT(YEAR FROM df.datum)::int, df.maand, EXTRACT(DAY FROM df.datum)::int,
                               CASE WHEN df.dagtype = 'weekend' THEN 13 ELSE 12 END, 0, 0)
              ELSE
                make_timestamp(EXTRACT(YEAR FROM df.datum)::int, df.maand, EXTRACT(DAY FROM df.datum)::int,
                               CASE WHEN df.dagtype = 'weekend' THEN 13 ELSE 12 END, 0, 0)
            END,
            -- eindtijd
            CASE
              WHEN df.maand = 3
                THEN make_timestamp(EXTRACT(YEAR FROM df.datum)::int, df.maand, EXTRACT(DAY FROM df.datum)::int, 20, 0, 0)
              ELSE make_timestamp(EXTRACT(YEAR FROM df.datum)::int, df.maand, EXTRACT(DAY FROM df.datum)::int, 22, 0, 0)
            END,
            interval '15 min'
          )
        ) gs
      ),
      q_with_pct AS (
        SELECT q.*, COALESCE(qs.q_pct, 0) AS q_pct_raw
        FROM quarters q
        LEFT JOIN quarter_share qs
          ON qs.maand = q.maand
         AND qs.dagtype = q.dagtype
         AND qs.uur = q.uur
         AND qs.kwartier = q.kwartier
      ),
      -- Her-normaliseer kwartierverdeling per dag tot 100%
      q_norm AS (
        SELECT
          datum, maand, dagtype, uur, kwartier, dag_omzet_forecast,
          CASE
            WHEN SUM(q_pct_raw) OVER (PARTITION BY datum) > 0
            THEN q_pct_raw / SUM(q_pct_raw) OVER (PARTITION BY datum)
            ELSE 1.0 / COUNT(*) OVER (PARTITION BY datum)
          END AS q_share
        FROM q_with_pct
      ),
      forecast_quarter AS (
        SELECT
          datum, uur, kwartier,
          (dag_omzet_forecast * q_share) AS omzet_forecast
        FROM q_norm
      ),
      staffing AS (
        SELECT
          datum, uur, kwartier, omzet_forecast,
          (omzet_forecast * 0.23) AS max_loonkosten,
          FLOOR((omzet_forecast * 0.23) / 3.75) AS max_medewerkers,
          CEIL(omzet_forecast / 100.0) AS behoefte_medewerkers,
          LEAST(FLOOR((omzet_forecast * 0.23) / 3.75), CEIL(omzet_forecast / 100.0)) AS inzet_medewerkers,
          LEAST(FLOOR((omzet_forecast * 0.23) / 3.75), CEIL(omzet_forecast / 100.0)) + 1 AS inzet_totaal_incl_keuken
        FROM forecast_quarter
      )
      SELECT *
      FROM staffing
      WHERE ($3::date IS NULL OR datum >= $3::date)
        AND ($4::date IS NULL OR datum <= $4::date)
      ORDER BY datum, uur, kwartier;
    `;

    const res = await dbRapportage.query(sql, [
      targetYear,
      groei,
      startParam || null,
      eindeParam || null,
    ]);

    return NextResponse.json({
      ok: true,
      jaar: targetYear,
      groei,
      count: res.rowCount ?? 0,
      data: res.rows,
    });
  } catch (err: any) {
    console.error('Prognose kwartier error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
