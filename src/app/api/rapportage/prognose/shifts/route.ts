// src/app/api/rapportage/prognose/shifts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbRapportage } from "@/lib/dbRapportage";

export const runtime = "nodejs";

/* ========= helpers ========= */
function isWeekend(d: Date) {
  const iso = ((d.getUTCDay() + 6) % 7) + 1; // 1=Mon..7=Sun
  return iso >= 6;
}
function toDateISOOnly(s: string) {
  const d = new Date(s + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) throw new Error("Ongeldige datum: " + s);
  return d;
}
function formatISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// --- param sanitisers (voorkomt 0:1 e.d.) ---
function takeFirstNumeric(v: string | null, def: number): number {
  if (v == null) return def;
  const first = String(v).split(":")[0].trim();
  const n = Number(first);
  return Number.isFinite(n) ? n : def;
}
function parseBinaryParam(v: string | null, def = 0): number {
  const n = takeFirstNumeric(v, def);
  return n === 1 ? 1 : 0;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/* ========= route ========= */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();

    const jaar = takeFirstNumeric(searchParams.get("jaar"), now.getFullYear());
    const maand = searchParams.get("maand") ? takeFirstNumeric(searchParams.get("maand"), 0) : null;

    const startParam = searchParams.get("start");
    const eindeParam = searchParams.get("einde");

    // parameters (gesanitized)
    const norm = takeFirstNumeric(searchParams.get("norm"), 100);                 // € per medewerker per kwartier
    const costPerQ = takeFirstNumeric(searchParams.get("cost_per_q"), 3.75);      // €15/u front
    const keukenBasis = parseBinaryParam(searchParams.get("keuken_basis"), 0);    // 0/1 – telt mee in kosten
    const standbyLate = clamp(takeFirstNumeric(searchParams.get("standby_late"), 1), 0, 2); // 0..2
    const maxShiftHours = takeFirstNumeric(searchParams.get("max_shift_hours"), 6); // 0 = geen limiet

    // Bereik bepalen
    let startDate: Date;
    let endDate: Date;
    if (startParam && eindeParam) {
      startDate = toDateISOOnly(startParam);
      endDate = toDateISOOnly(eindeParam);
    } else if (maand) {
      startDate = toDateISOOnly(`${jaar}-${pad2(maand)}-01`);
      endDate = new Date(Date.UTC(jaar, maand, 0)); // laatste dag van maand
    } else {
      startDate = toDateISOOnly(`${jaar}-01-01`);
      endDate = toDateISOOnly(`${jaar}-12-31`);
    }

    // ================= SQL: forecast + ruwe behoefte =================
    // Let op: generate_series aliassen we als "ts" en gebruiken EXTRACT(... FROM gs.ts)
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
          df.datum, df.maand, df.dagtype, df.dag_omzet_forecast, gs.ts AS ts,
          EXTRACT(HOUR FROM gs.ts)::int AS uur,
          (FLOOR(EXTRACT(MINUTE FROM gs.ts)::int / 15) + 1)::int AS kwartier
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
          ) AS ts
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
          CEIL(omzet_forecast / $2::numeric) AS behoefte_medewerkers,
          FLOOR((omzet_forecast * 0.23) / $3::numeric) AS max_medewerkers
        FROM forecast_quarter
      )
      SELECT
        datum, uur, kwartier,
        omzet_forecast,
        LEAST(max_medewerkers, behoefte_medewerkers) AS front_needed
      FROM staffing
      WHERE datum BETWEEN $4::date AND $5::date
      ORDER BY datum, uur, kwartier;
    `;

    // $1 jaar, $2 norm, $3 costPerQ, $4 start, $5 einde
    const raw = await dbRapportage.query(sql, [
      jaar,            // $1
      norm,            // $2
      costPerQ,        // $3
      formatISO(startDate), // $4
      formatISO(endDate),   // $5
    ]);

    // normaliseer result
    type Row = {
      datum: string;
      uur: number;
      kwartier: number;
      omzet_forecast: number;
      front_needed: number;
    };
    const rows: Row[] = raw.rows.map((r: any) => ({
      datum: typeof r.datum === "string" ? r.datum : new Date(r.datum).toISOString().slice(0, 10),
      uur: Number(r.uur),
      kwartier: Number(r.kwartier),
      omzet_forecast: Math.max(0, Number(r.omzet_forecast) || 0),
      front_needed: Math.max(0, Number(r.front_needed) || 0),
    }));

    // index per dag
    const byDate: Record<string, Row[]> = {};
    for (const r of rows) (byDate[r.datum] ||= []).push(r);

    /* ========== packer met budget-bewaking + opstart 30 min ========== */
    const costFront = costPerQ; // € per kwartier
    const costKeuken = 5.0;     // €20/u => €5/kw

    type Shift = { role: "front" | "standby"; start: string; end: string; count: number };

    function qToTime(dayStartHour: number, qIdx: number) {
      const mins = Math.round(dayStartHour * 60 + qIdx * 15);
      const hh = Math.floor(mins / 60);
      const mm = mins % 60;
      return `${pad2(hh)}:${pad2(mm)}`;
    }

    function planDay(datumISO: string, month: number, isWknd: boolean) {
      const openHour = month === 3 ? (isWknd ? 13 : 12) : (isWknd ? 13 : 12);
      const closeHour = month === 3 ? 20 : 22;
      const cleanHour = month === 3 ? 21 : 23;

      const dayStartHour = openHour - 0.5; // opstart 30m voor opening
      const splitHour = 17.5;              // heilige wissel
      const qOpen  = Math.round(openHour * 4);
      const qSplit = Math.round(splitHour * 4);
      const qEnd   = Math.round(cleanHour * 4);
      const qStart = Math.round(dayStartHour * 4);

      const rowsForDay = byDate[datumISO] || [];

      // curves
      const totalQ = qEnd - qStart;
      const need: number[] = new Array(totalQ).fill(1); // min 1 continuous coverage
      const omzet: number[] = new Array(totalQ).fill(0);

      // open range vullen met forecast
      for (let absQ = qOpen; absQ < qEnd; absQ++) {
        const h = Math.floor(absQ / 4);
        const k = (absQ % 4) + 1;
        const rr = rowsForDay.find((x) => x.uur === h && x.kwartier === k);
        const idx = absQ - qStart;
        if (idx >= 0 && idx < totalQ) {
          need[idx] = Math.max(1, rr?.front_needed ?? 1);
          omzet[idx] = Math.max(0, rr?.omzet_forecast ?? 0);
        }
      }

      const budget = omzet.map((v) => 0.23 * v);
      const planned = new Array(totalQ).fill(0);

      const shifts: Shift[] = [];
      const minQ = 12; // 3u
      const maxQ = maxShiftHours > 0 ? maxShiftHours * 4 : Number.POSITIVE_INFINITY;

      function canAfford(start: number, end: number, addCount: number) {
        for (let i = start; i < end; i++) {
          const cost = (planned[i] + addCount) * costFront + keukenBasis * costKeuken;
          if (cost > budget[i] + 1e-6) return false;
        }
        return true;
      }

      function addFrontShift(blockStartHour: number, startLocalQ: number, endLocalQ: number, count: number) {
        if (count <= 0 || endLocalQ <= startLocalQ) return;
        const startTime = qToTime(blockStartHour, startLocalQ);
        const endTime   = qToTime(blockStartHour, endLocalQ);
        shifts.push({ role: "front", start: startTime, end: endTime, count });
      }

      function fillBlock(blockAbsStartQ: number, blockAbsEndQ: number, blockStartHour: number) {
        const qStartLocal = blockAbsStartQ - qStart;
        const qEndLocal   = blockAbsEndQ   - qStart;

        // baseline: 1 front over hele blok
        addFrontShift(blockStartHour, 0, qEndLocal - qStartLocal, 1);
        for (let i = qStartLocal; i < qEndLocal; i++) planned[i] += 1;

        // extra capaciteit voor gaten
        while (true) {
          // zoek eerste gat
          let firstGap = -1;
          for (let i = qStartLocal; i < qEndLocal; i++) {
            if (planned[i] < need[i]) { firstGap = i; break; }
          }
          if (firstGap === -1) break;

          // minimaal 3u
          let start = firstGap;
          let end = Math.min(start + Math.max(minQ, 1), qEndLocal);
          if (end - start < minQ) {
            start = Math.max(qStartLocal, qEndLocal - minQ);
            end = Math.min(start + minQ, qEndLocal);
          }

          // hoeveel erbij?
          let gap = 0;
          for (let i = start; i < end; i++) gap = Math.max(gap, need[i] - planned[i]);
          let add = Math.max(1, gap);

          // budgetcheck
          while (add > 0 && !canAfford(start, end, add)) add--;
          if (add <= 0) {
            planned[start] = Math.max(planned[start], need[start]); // infinite loop voorkomen
            continue;
          }

          // plannen
          for (let i = start; i < end; i++) planned[i] += add;
          addFrontShift(blockStartHour, start - qStartLocal, end - qStartLocal, add);
        }
      }

      // blokken: [start..17:30) en [17:30..clean]
      fillBlock(qStart, qSplit, dayStartHour);
      fillBlock(qSplit, qEnd, 17.5);

      // standby late
      if (standbyLate > 0) {
        shifts.push({
          role: "standby",
          start: "19:00",
          end: month === 3 ? "21:00" : "23:00",
          count: standbyLate,
        });
      }

      return {
        date: datumISO,
        open: `${pad2(openHour)}:00`,
        close: `${pad2(closeHour)}:00`,
        clean_done: `${pad2(cleanHour)}:00`,
        shifts,
      };
    }

    // per dag plannen
    const days: any[] = [];
    for (let d = new Date(startDate); d <= endDate; d = new Date(d.getTime() + 86400000)) {
      const iso = formatISO(d);
      const wknd = isWeekend(d);
      const m = d.getUTCMonth() + 1;
      if (byDate[iso]) {
        days.push(planDay(iso, m, wknd));
      }
    }

    return NextResponse.json({
      ok: true,
      range: { start: formatISO(startDate), einde: formatISO(endDate) },
      params: { norm, costPerQ, keukenBasis, standbyLate, maxShiftHours },
      days,
    });
  } catch (err: any) {
    console.error("shift-forecast error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
