// src/app/api/rapportage/prognose/shifts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbRapportage } from "@/lib/dbRapportage";

export const runtime = "nodejs";

/** Helpers */
function isWeekend(d: Date) {
  const iso = (d.getUTCDay() + 6) % 7 + 1; // 1=Mon..7=Sun
  return iso >= 6;
}
function toDate(s: string) {
  const d = new Date(s + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) throw new Error("Ongeldige datum: " + s);
  return d;
}
function formatISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();

    const jaar = parseInt(searchParams.get("jaar") || String(now.getFullYear()), 10);
    const maand = searchParams.get("maand") ? parseInt(searchParams.get("maand")!, 10) : null;

    const startParam = searchParams.get("start");
    const eindeParam = searchParams.get("einde");

    const norm = Number(searchParams.get("norm") || "100");           // € per medewerker per kwartier
    const costPerQ = Number(searchParams.get("cost_per_q") || "3.75"); // loonkosten per kwartier per front medewerker
    const keukenBasis = Number(searchParams.get("keuken_basis") || "0"); // 0/1 kostenmatig meenemen
    const standbyLate = Number(searchParams.get("standby_late") || "1"); // 0/1/2
    const maxShiftHours = Number(searchParams.get("max_shift_hours") || "6"); // 0 = geen limiet

    // Bereik bepalen
    let startDate: Date;
    let endDate: Date;
    if (startParam && eindeParam) {
      startDate = toDate(startParam);
      endDate = toDate(eindeParam);
    } else if (maand) {
      startDate = toDate(`${jaar}-${String(maand).padStart(2,"0")}-01`);
      endDate = new Date(Date.UTC(jaar, maand, 0)); // laatste dag maand
    } else {
      startDate = toDate(`${jaar}-01-01`);
      endDate = toDate(`${jaar}-12-31`);
    }

    // === 1) Forecast per kwartier ophalen (hergebruikt jouw eerdere logica, versimpeld) ===
    // We gebruiken dezelfde staffing-CTE als eerder, maar alleen de kolommen die we nodig hebben.
    const sql = `
      WITH
      hist_day AS (
        SELECT
          k.datum::date AS datum,
          EXTRACT(MONTH FROM k.datum)::int AS maand,
          CASE WHEN EXTRACT(ISODOW FROM k.datum) IN (6,7) THEN 'weekend' ELSE 'week' END AS dagtype,
          SUM(k.omzet) AS dag_omzet
        FROM rapportage.omzet_kwartier k
        GROUP BY 1,2,3
      ),
      month_year_totals AS (
        SELECT EXTRACT(YEAR FROM k.datum)::int AS jaar,
               EXTRACT(MONTH FROM k.datum)::int AS maand,
               SUM(k.omzet) AS maand_omzet
        FROM rapportage.omzet_kwartier k
        GROUP BY 1,2
      ),
      year_totals AS (
        SELECT jaar, SUM(maand_omzet) AS jaar_omzet
        FROM month_year_totals GROUP BY 1
      ),
      month_pct_per_year AS (
        SELECT m.jaar, m.maand,
               CASE WHEN y.jaar_omzet > 0 THEN m.maand_omzet / y.jaar_omzet ELSE 0 END AS pct
        FROM month_year_totals m JOIN year_totals y USING (jaar)
      ),
      month_share AS (
        SELECT maand, AVG(pct) AS maand_pct
        FROM month_pct_per_year GROUP BY maand
      ),
      daytype_weight AS (
        SELECT EXTRACT(MONTH FROM datum)::int AS maand, dagtype, AVG(dag_omzet) AS avg_dag_omzet
        FROM hist_day GROUP BY 1,2
      ),
      daytype_norm AS (
        SELECT maand, dagtype, avg_dag_omzet,
               SUM(avg_dag_omzet) OVER (PARTITION BY maand) AS sum_month
        FROM daytype_weight
      ),
      daytype_share AS (
        SELECT maand, dagtype,
               CASE WHEN sum_month > 0 THEN avg_dag_omzet / sum_month ELSE 0.5 END AS dagtype_pct
        FROM daytype_norm
      ),
      quarter_share AS (
        SELECT EXTRACT(MONTH FROM k.datum)::int AS maand,
               CASE WHEN EXTRACT(ISODOW FROM k.datum) IN (6,7) THEN 'weekend' ELSE 'week' END AS dagtype,
               k.uur, k.kwartier,
               AVG( k.omzet / NULLIF(d.dag_omzet, 0) ) AS q_pct
        FROM rapportage.omzet_kwartier k
        JOIN hist_day d ON d.datum = k.datum
        GROUP BY 1,2,3,4
      ),
      baseline AS (
        SELECT COALESCE((
          SELECT SUM(aantal * eenheidsprijs)
          FROM rapportage.omzet
          WHERE EXTRACT(YEAR FROM datum)::int = $1 - 1
        ), 0) AS vorigjaar
      ),
      year_target AS (
        SELECT CASE WHEN vorigjaar > 0 THEN ROUND(vorigjaar * 1.03) ELSE 0 END AS jaar_omzet
        FROM baseline
      ),
      calendar_days AS (
        SELECT d::date AS datum,
               EXTRACT(MONTH FROM d)::int AS maand,
               CASE WHEN EXTRACT(ISODOW FROM d) IN (6,7) THEN 'weekend' ELSE 'week' END AS dagtype
        FROM generate_series(make_date($1,1,1), make_date($1,12,31), interval '1 day') d
      ),
      month_day_counts AS (
        SELECT maand, dagtype, COUNT(*) AS n_days
        FROM calendar_days GROUP BY 1,2
      ),
      day_share AS (
        SELECT c.datum, c.maand, c.dagtype,
               (SELECT maand_pct FROM month_share ms WHERE ms.maand = c.maand) AS maand_pct,
               (SELECT dagtype_pct FROM daytype_share ds WHERE ds.maand = c.maand AND ds.dagtype = c.dagtype) AS dagtype_pct,
               (SELECT n_days FROM month_day_counts mdc WHERE mdc.maand = c.maand AND mdc.dagtype = c.dagtype) AS n_days
        FROM calendar_days c
      ),
      day_forecast AS (
        SELECT datum, maand, dagtype,
               (SELECT jaar_omzet FROM year_target)
               * COALESCE(maand_pct,0) * COALESCE(dagtype_pct,0) / GREATEST(n_days,1) AS dag_omzet_forecast
        FROM day_share
      ),
      quarters AS (
        SELECT
          df.datum, df.maand, df.dagtype, df.dag_omzet_forecast, gs AS ts,
          EXTRACT(HOUR FROM gs)::int AS uur,
          (FLOOR(EXTRACT(MINUTE FROM gs)::int / 15) + 1)::int AS kwartier
        FROM day_forecast df
        CROSS JOIN LATERAL (
          SELECT generate_series(
            CASE
              WHEN df.maand = 3 THEN
                make_timestamp(EXTRACT(YEAR FROM df.datum)::int, df.maand, EXTRACT(DAY FROM df.datum)::int,
                               CASE WHEN df.dagtype='weekend' THEN 13 ELSE 12 END, 0, 0)
              ELSE
                make_timestamp(EXTRACT(YEAR FROM df.datum)::int, df.maand, EXTRACT(DAY FROM df.datum)::int,
                               CASE WHEN df.dagtype='weekend' THEN 13 ELSE 12 END, 0, 0)
            END,
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
        SELECT q.*, COALESCE(qs.q_pct,0) AS q_pct_raw
        FROM quarters q
        LEFT JOIN quarter_share qs
          ON qs.maand=q.maand AND qs.dagtype=q.dagtype AND qs.uur=q.uur AND qs.kwartier=q.kwartier
      ),
      q_norm AS (
        SELECT datum, maand, dagtype, uur, kwartier, dag_omzet_forecast,
               CASE WHEN SUM(q_pct_raw) OVER (PARTITION BY datum) > 0
                    THEN q_pct_raw / SUM(q_pct_raw) OVER (PARTITION BY datum)
                    ELSE 1.0 / COUNT(*) OVER (PARTITION BY datum)
               END AS q_share
        FROM q_with_pct
      ),
      forecast_quarter AS (
        SELECT datum, uur, kwartier, (dag_omzet_forecast * q_share) AS omzet_forecast
        FROM q_norm
      ),
      staffing AS (
        SELECT
          datum, uur, kwartier, omzet_forecast,
          -- front benodigde inzet: min( omzet/norm , kostenplafond )
          CEIL(omzet_forecast / $2::numeric) AS behoefte_medewerkers,
          FLOOR((omzet_forecast * 0.23) / $3::numeric) AS max_medewerkers
        FROM forecast_quarter
      )
      SELECT
        datum, uur, kwartier,
        GREATEST(0, LEAST(max_medewerkers, behoefte_medewerkers) - $4::int) AS front_needed  -- keuken_basis kan kostenmatig 'opeten'
      FROM staffing
      WHERE datum BETWEEN $5::date AND $6::date
      ORDER BY datum, uur, kwartier;
    `;

    const res = await dbRapportage.query(sql, [
      jaar,            // $1
      norm,            // $2
      costPerQ,        // $3
      keukenBasis,     // $4
      formatISO(startDate), // $5
      formatISO(endDate),   // $6
    ]);

    // === 2) Van kwartierbehoefte naar shifts per dag (greedy packer) ===
    type Q = { t: number; need: number }; // t = kwartierindex vanaf dagstart
    type Shift = { start: string; end: string; count: number; role: 'front' | 'standby' };

    // helper: kwartier->tijdstring
    function qToTime(dayStartHour: number, qIdx: number) {
      const mins = dayStartHour * 60 + qIdx * 15;
      const hh = Math.floor(mins / 60);
      const mm = mins % 60;
      return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
    }

    // plan 1 dag in 2 blokken: [open .. 17:30) en [17:30 .. sluit+schoon)
    function planDay(datumISO: string, month: number, isWknd: boolean) {
      const openHour = (month === 3) ? (isWknd ? 13 : 12) : (isWknd ? 13 : 12);
      const closeHour = (month === 3) ? 20 : 22;
      const cleanHour = (month === 3) ? 21 : 23;
      const startQ = 0; // we genereren data vanaf open; opstart 11:30 kun je apart aanzetten indien gewenst
      const qPerBlockA = ((17 * 60 + 30) - (openHour * 60)) / 15;  // open .. 17:30
      const qPerBlockB = ((cleanHour * 60) - (17 * 60 + 30)) / 15; // 17:30 .. schoon klaar
      const totalQ = qPerBlockA + qPerBlockB;

      const rows = res.rows.filter(r => r.datum.toISOString().slice(0,10) === datumISO);
      // front_needed per kwartier vanaf openHour
      const curve: number[] = [];
      for (let qi = 0; qi < totalQ; qi++) {
        const absHour = Math.floor((openHour * 60 + qi * 15) / 60);
        const absQ = ((openHour * 60 + qi * 15) % 60) / 15 + 1;
        const row = rows.find(rr => rr.uur === absHour && rr.kwartier === absQ);
        curve.push(Math.max(0, row?.front_needed ?? 0));
      }

      // greedy packer op blok A en B
      const shifts: Shift[] = [];
      const minQ = 12; // 3 uur
      const maxQ = (maxShiftHours > 0 ? maxShiftHours * 4 : Number.POSITIVE_INFINITY);

      function fillBlock(offsetQ: number, lenQ: number, dayStartHour: number) {
        // deficit array voor dit blok
        const need = curve.slice(offsetQ, offsetQ + lenQ);
        // zolang er nog behoefte >0 is, starten we een shift
        while (true) {
  const idx = need.findIndex(v => v > 0);
  if (idx === -1) break;
  const startIdx = idx;
  let endIdx = Math.min(startIdx + Math.max(minQ, 1), lenQ);
  while (endIdx < lenQ && (endIdx - startIdx) < maxQ && need.slice(startIdx, endIdx).some(v => v > 0)) {
    endIdx++;
          }
          // hoeveel mensen tegelijk nodig binnen dit interval? = max behoefte in interval
          const maxNeed = Math.max(...need.slice(startIdx, endIdx));
          // plan exact zoveel personen
          for (let i = startIdx; i < endIdx; i++) need[i] = Math.max(0, need[i] - maxNeed);

          // transleer naar kloktijden
          const absStartQ = offsetQ + startIdx;
          const absEndQ = offsetQ + endIdx;
          const startStr = qToTime(dayStartHour, startIdx);
          const endStr = qToTime(dayStartHour, endIdx);

          shifts.push({ role: "front", start: startStr, end: endStr, count: maxNeed });
        }
      }

      // blok A: open..17:30
      fillBlock(0, qPerBlockA, openHour);
      // blok B: 17:30..cleanHour
      fillBlock(qPerBlockA, qPerBlockB, 17 + 0.5); // 17.5 => 17:30

      // standby late
      if (standbyLate > 0) {
        shifts.push({
          role: "standby",
          start: "19:00",
          end: (month === 3 ? "21:00" : "23:00"),
          count: standbyLate
        });
      }

      return { date: datumISO, open: `${openHour}:00`, close: `${closeHour}:00`, clean_done: `${cleanHour}:00`, shifts };
    }

    // loop dagen
    const out: any[] = [];
    for (let d = new Date(startDate); d <= endDate; d = new Date(d.getTime() + 86400000)) {
      const iso = formatISO(d);
      const wknd = isWeekend(d);
      const m = d.getUTCMonth() + 1;
      // plan alleen als er forecast entries zijn
      if (res.rows.find(r => r.datum.toISOString().slice(0,10) === iso)) {
        out.push(planDay(iso, m, wknd));
      }
    }

    return NextResponse.json({
      ok: true,
      range: { start: formatISO(startDate), einde: formatISO(endDate) },
      params: { norm, costPerQ, keukenBasis, standbyLate, maxShiftHours },
      days: out
    });
  } catch (err: any) {
    console.error("shift-forecast error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
