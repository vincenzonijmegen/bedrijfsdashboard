// src/app/api/rapportage/prognose/shifts-mw/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbRapportage } from "@/lib/dbRapportage";

export const runtime = "nodejs";

/** ---------- utils ---------- */
const pad2 = (n: number) => String(n).padStart(2, "0");

function parseWeekday(val: string | null): number | null {
  if (!val) return null;
  const lower = val.toLowerCase();
  // ISO 1=Mon..7=Sun
  const mapText: Record<string, number> = {
    ma: 1, maa: 1, maandag: 1, mon: 1, monday: 1,
    di: 2, din: 2, dinsdag: 2, tue: 2, tuesday: 2,
    wo: 3, woe: 3, woensdag: 3, wed: 3, wednesday: 3,
    do: 4, don: 4, donderdag: 4, thu: 4, thursday: 4,
    vr: 5, vri: 5, vrijdag: 5, fri: 5, friday: 5,
    za: 6, zat: 6, zaterdag: 6, sat: 6, saturday: 6,
    zo: 7, zon: 7, zondag: 7, sun: 7, sunday: 7,
    feestdag: 7 // treat as Sunday timing
  };
  if (mapText[lower] !== undefined) return mapText[lower];
  const n = Number(val);
  if (Number.isInteger(n) && n >= 1 && n <= 7) return n;
  return null;
}

function toISODateOnly(s: string) {
  const d = new Date(s + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) throw new Error("Ongeldige datum: " + s);
  return d.toISOString().slice(0, 10);
}

/** Convert hour (e.g. 11.5) + qIdx to HH:MM inside a block that starts at blockStartHour */
function qToTime(blockStartHour: number, qIdx: number) {
  const mins = Math.round(blockStartHour * 60 + qIdx * 15);
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return `${pad2(hh)}:${pad2(mm)}`;
}

/** ---------- route ---------- */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // required params
    const maand = Number(searchParams.get("maand") || searchParams.get("month"));
    const wd = parseWeekday(searchParams.get("weekdag") || searchParams.get("weekday") || searchParams.get("wd"));
    if (!maand || maand < 1 || maand > 12) {
      return NextResponse.json({ ok: false, error: "Geef ?maand=1..12 mee." }, { status: 400 });
    }
    if (!wd) {
      return NextResponse.json({ ok: false, error: "Geef ?weekdag=1..7 of (ma,di,...,zo) mee." }, { status: 400 });
    }

    // optional params
    const now = new Date();
    const jaar = Number(searchParams.get("jaar") || now.getFullYear());
    const groei = Number(searchParams.get("groei") || 1.03);
    const norm = Number(searchParams.get("norm") || 100);          // € per medewerker per kwartier
    const costPerQ = Number(searchParams.get("cost_per_q") || 3.75); // €15/u front
    const standbyDayStart = (searchParams.get("standby_day_start") || "14:00").trim();   // HH:MM
    const standbyEveStart = (searchParams.get("standby_eve_start") || "19:00").trim();   // HH:MM

    // --- Opening/coverage rules based on month/weekdag ---
    // Sunday timing (and treat 'feestdag' as Sunday)
    const isSunday = wd === 7;
    // Opening hours (sales)
    const openHour = isSunday ? (maand === 3 ? 13 : 13) : (maand === 3 ? 12 : 12);
    const closeHour = maand === 3 ? 20 : 22;
    // Cleaning end
    const cleanHour = maand === 3 ? 21 : 23;
    // Mandatory coverage start (11:30 normal, 12:30 on Sun/feast)
    const coverageStartHour = isSunday ? 12.5 : 11.5; // 12:30 vs 11:30
    // Sacred split
    const splitHour = 17.5; // 17:30
    // Sanity
    if (coverageStartHour >= cleanHour) {
      return NextResponse.json({ ok: false, error: "Coverage window ongeldig." }, { status: 400 });
    }

    // ===================== SQL =====================
    // Build a typical day for (maand, weekdag) by averaging historical patterns.
    // Then scale by jaar-forecast: vorig jaar * groei and month share and weekday share.
    const sql = `
      WITH
      hist_day AS (
        SELECT
          k.datum::date             AS datum,
          EXTRACT(YEAR  FROM k.datum)::int AS jaar,
          EXTRACT(MONTH FROM k.datum)::int AS maand,
          EXTRACT(ISODOW FROM k.datum)::int AS isodow,
          SUM(k.omzet)              AS dag_omzet
        FROM rapportage.omzet_kwartier k
        GROUP BY 1,2,3,4
      ),
      month_year_totals AS (
        SELECT jaar, maand, SUM(dag_omzet) AS maand_omzet
        FROM hist_day
        GROUP BY 1,2
      ),
      year_totals AS (
        SELECT jaar, SUM(maand_omzet) AS jaar_omzet
        FROM month_year_totals
        GROUP BY 1
      ),
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
      weekday_weight AS (
        SELECT maand, isodow, AVG(dag_omzet) AS avg_dag_omzet
        FROM hist_day
        GROUP BY 1,2
      ),
      weekday_share AS (
        SELECT
          w.maand, w.isodow, w.avg_dag_omzet,
          SUM(w.avg_dag_omzet) OVER (PARTITION BY w.maand) AS month_sum
        FROM weekday_weight w
      ),
      weekday_share_norm AS (
        SELECT maand, isodow,
               CASE WHEN month_sum > 0 THEN avg_dag_omzet / month_sum ELSE 1.0/7 END AS wd_pct
        FROM weekday_share
      ),
      baseline AS (
        SELECT COALESCE((
          SELECT SUM(aantal * eenheidsprijs)
          FROM rapportage.omzet
          WHERE EXTRACT(YEAR FROM datum)::int = $1 - 1
        ), 0) AS vorigjaar
      ),
      year_target AS (
        SELECT ROUND((SELECT vorigjaar FROM baseline) * $2::numeric) AS jaar_omzet
      ),
      month_target AS (
        SELECT
          ($3)::int AS maand,
          (SELECT jaar_omzet FROM year_target)
          * COALESCE((SELECT maand_pct FROM month_share WHERE maand = $3::int), 0) AS maand_omzet
      ),
      n_days_wd AS (
        SELECT COUNT(*)::int AS n
        FROM generate_series(
          make_date($1::int, $3::int, 1),
          (make_date($1::int, $3::int, 1) + INTERVAL '1 month - 1 day')::date,
          '1 day'
        ) d
        WHERE EXTRACT(ISODOW FROM d)::int = $4::int
      ),
      day_forecast AS (
        SELECT
          (SELECT maand_omzet FROM month_target)
          * COALESCE((SELECT wd_pct FROM weekday_share_norm WHERE maand = $3::int AND isodow = $4::int), 1.0/7)
          / GREATEST((SELECT n FROM n_days_wd), 1) AS dag_omzet_forecast
      ),
      quarter_share_wd AS (
        SELECT
          EXTRACT(MONTH  FROM k.datum)::int  AS maand,
          EXTRACT(ISODOW FROM k.datum)::int  AS isodow,
          k.uur, k.kwartier,
          AVG(k.omzet / NULLIF(d.dag_omzet, 0)) AS q_pct
        FROM rapportage.omzet_kwartier k
        JOIN hist_day d ON d.datum = k.datum
        WHERE EXTRACT(MONTH FROM k.datum)::int = $3::int
          AND EXTRACT(ISODOW FROM k.datum)::int = $4::int
        GROUP BY 1,2,3,4
      ),
      quarters_open AS (
        SELECT
          gs.ts,
          EXTRACT(HOUR   FROM gs.ts)::int AS uur,
          (FLOOR(EXTRACT(MINUTE FROM gs.ts)::int / 15) + 1)::int AS kwartier
        FROM (
          SELECT generate_series(
            make_timestamp($1::int, $3::int, 1,  -- dag=1 is irrelevant (we normaliseren toch per dag)
                           CASE WHEN $4::int = 7 THEN 13 ELSE 12 END, 0, 0),
            make_timestamp($1::int, $3::int, 1,
                           CASE WHEN $5::int = 1 THEN 20 ELSE 22 END, 0, 0),   -- $5 = (maand=3 ? 1 : 0)
            '15 min'
          ) AS ts
        ) gs
      ),
      q_with_pct AS (
        SELECT q.uur, q.kwartier, COALESCE(s.q_pct, 0) AS q_pct_raw
        FROM quarters_open q
        LEFT JOIN quarter_share_wd s
          ON s.maand = $3::int AND s.isodow = $4::int AND s.uur = q.uur AND s.kwartier = q.kwartier
      ),
      q_norm AS (
        SELECT
          uur, kwartier,
          CASE
            WHEN SUM(q_pct_raw) OVER () > 0
              THEN q_pct_raw / SUM(q_pct_raw) OVER ()
            ELSE 1.0 / NULLIF(COUNT(*) OVER (), 0)
          END AS q_share
        FROM q_with_pct
      ),
      forecast_quarter AS (
        SELECT
          uur, kwartier,
          (SELECT dag_omzet_forecast FROM day_forecast) * q_share AS omzet_forecast
        FROM q_norm
      )
      SELECT
        uur, kwartier,
        omzet_forecast,
        CEIL(omzet_forecast / $6::numeric) AS need_front       -- norm (€/medewerker/kwartier)
      FROM forecast_quarter
      ORDER BY uur, kwartier;
    `;

    // $1 jaar, $2 groei, $3 maand, $4 weekdag(ISO), $5 isMarchFlag, $6 norm
    const raw = await dbRapportage.query(sql, [
      jaar, groei, maand, wd, maand === 3 ? 1 : 0, norm
    ]);

    type Row = { uur: number; kwartier: number; omzet_forecast: number; need_front: number };
    const rows: Row[] = raw.rows.map((r: any) => ({
      uur: Number(r.uur),
      kwartier: Number(r.kwartier),
      omzet_forecast: Math.max(0, Number(r.omzet_forecast) || 0),
      need_front: Math.max(0, Number(r.need_front) || 0),
    }));

    // ---------- Build full coverage curve (11:30/12:30 .. cleanHour) ----------
    const qStart = Math.round(coverageStartHour * 4);
    const qOpen  = Math.round(openHour * 4);
    const qClose = Math.round(closeHour * 4);
    const qClean = Math.round(cleanHour * 4);

    const totalQ = qClean - qStart;                // from coverage start to clean end
    const openLenQ = qClose - qOpen;               // open quarters
    const need: number[] = new Array(totalQ).fill(1);      // at least 1 continuous coverage
    const omzet: number[] = new Array(totalQ).fill(0);

    // fill open quarters with forecast needs
    for (let qi = 0; qi < openLenQ; qi++) {
      const absQ = qOpen + qi;                                // absolute quarter index of day (0..96)
      const h = Math.floor(absQ / 4);
      const k = (absQ % 4) + 1;
      const m = rows.find((x) => x.uur === h && x.kwartier === k);
      const idx = absQ - qStart;                              // local index in coverage array
      if (idx >= 0 && idx < totalQ) {
        const needed = Math.max(1, m ? m.need_front : 1);     // enforce min 1 while open
        need[idx] = needed;
        omzet[idx] = Math.max(0, m ? m.omzet_forecast : 0);
      }
    }
    // Pre-open (coverage before opening) and post-close (cleaning) already have need=1, omzet=0

    // ---------- Baseline shifts: always 1 front per block (day & evening) ----------
    const minQ = 12; // 3 hours
    const splitQ = Math.round(splitHour * 4);
    const dayBlockStartQ = qStart;
    const dayBlockEndQ   = Math.min(splitQ, qClean);
    const eveBlockStartQ = Math.min(splitQ, qClean);
    const eveBlockEndQ   = qClean;

    type Shift = { role: "front" | "standby"; start: string; end: string; count: number };

    const planned: number[] = new Array(totalQ).fill(0);
    const shifts: Shift[] = [];

    // helper to push a front shift and mark planned curve
    function addFrontShift(blockStartHour: number, startLocalQ: number, endLocalQ: number, count: number) {
      const startTime = qToTime(blockStartHour, startLocalQ);
      const endTime   = qToTime(blockStartHour, endLocalQ);
      if (count > 0 && endLocalQ > startLocalQ) {
        shifts.push({ role: "front", start: startTime, end: endTime, count });
        for (let i = startLocalQ; i < endLocalQ; i++) planned[i] += count;
      }
    }

    // Baseline day shift (full day block, min 3h guaranteed by construction)
    const dayBlockLenLocal = dayBlockEndQ - dayBlockStartQ;
    if (dayBlockLenLocal > 0) {
      addFrontShift(coverageStartHour, 0, dayBlockLenLocal, 1);
    }

    // Baseline evening shift
    const eveBlockLenLocal = eveBlockEndQ - eveBlockStartQ;
    if (eveBlockLenLocal > 0) {
      const eveStartLocal = eveBlockStartQ - qStart;
      addFrontShift(coverageStartHour, eveStartLocal, eveStartLocal + eveBlockLenLocal, 1);
    }

    // ---------- Greedy fill to cover additional need (beyond baseline), respect min 3h & 17:30 boundary ----------
    function fillBlock(blockAbsStartQ: number, blockAbsEndQ: number, blockStartHour: number) {
      const localStart = blockAbsStartQ - qStart;
      const localEnd   = blockAbsEndQ   - qStart;

      while (true) {
        // find first quarter in block where we still have a gap
        let firstGap = -1;
        for (let i = localStart; i < localEnd; i++) {
          if (planned[i] < need[i]) { firstGap = i; break; }
        }
        if (firstGap === -1) break;

        // ensure minimum 3h; if too close to block end, shift start left so that end=start+minQ fits
        let startQ = firstGap;
        let endQ = Math.min(startQ + minQ, localEnd);
        if (endQ - startQ < minQ) {
          startQ = Math.max(localStart, localEnd - minQ);
          endQ = Math.min(startQ + minQ, localEnd);
        }

        // compute max gap over interval
        let gap = 0;
        for (let i = startQ; i < endQ; i++) gap = Math.max(gap, need[i] - planned[i]);
        const add = Math.max(1, gap);

        addFrontShift(blockStartHour, startQ - localStart, endQ - localStart, add);
      }
    }

    // Fill day block (from coverageStart to 17:30)
    fillBlock(dayBlockStartQ, dayBlockEndQ, coverageStartHour);
    // Fill evening block (from 17:30 to clean end)
    fillBlock(eveBlockStartQ, eveBlockEndQ, 17.5);

    // ---------- Standby shifts (always 1 per block) ----------
    // Day standby: from configured standbyDayStart until 17:30 (or block end)
    const [sdH, sdM] = standbyDayStart.split(":").map(Number);
    const standbyDayStartHour = (Number.isFinite(sdH) ? sdH : 14) + ((Number.isFinite(sdM) ? sdM : 0) / 60);
    const standbyDayStartAbsQ = Math.max(qStart, Math.round(standbyDayStartHour * 4));
    if (dayBlockEndQ > standbyDayStartAbsQ) {
      const startLocal = standbyDayStartAbsQ - qStart;
      const endLocal   = dayBlockEndQ - qStart;
      shifts.push({
        role: "standby",
        start: qToTime(coverageStartHour, startLocal),
        end:   qToTime(coverageStartHour, endLocal),
        count: 1
      });
    }

    // Evening standby: from configured standbyEveStart until clean end
    const [seH, seM] = standbyEveStart.split(":").map(Number);
    const standbyEveStartHour = (Number.isFinite(seH) ? seH : 19) + ((Number.isFinite(seM) ? seM : 0) / 60);
    const standbyEveStartAbsQ = Math.max(eveBlockStartQ, Math.round(standbyEveStartHour * 4));
    if (eveBlockEndQ > standbyEveStartAbsQ) {
      const startLocal = standbyEveStartAbsQ - qStart;
      const endLocal   = eveBlockEndQ - qStart;
      shifts.push({
        role: "standby",
        start: qToTime(coverageStartHour, startLocal),
        end:   qToTime(coverageStartHour, endLocal),
        count: 1
      });
    }

    // ---------- Build per-quarter output (optional insight for UI) ----------
    const quarters = Array.from({ length: totalQ }, (_, i) => {
      const mins = coverageStartHour * 60 + i * 15;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      const label = `${pad2(h)}:${pad2(m)}`;
      return {
        time: label,
        need: need[i],
        planned: planned[i],
        omzet: Number(omzet[i].toFixed(2)),
        // budget vs. cost (informatief; dekkingsregel is "altijd min. 1 aanwezig")
        budget: Number((omzet[i] * 0.23).toFixed(2)),
        cost_front: Number((planned[i] * costPerQ).toFixed(2))
      };
    });

    return NextResponse.json({
      ok: true,
      params: {
        jaar,
        groei,
        maand,
        weekdag: wd,
        norm,
        costPerQ,
        coverage: {
          start: `${pad2(Math.floor(coverageStartHour))}:${pad2((coverageStartHour % 1) * 60 || 0)}`,
          open: `${pad2(openHour)}:00`,
          split: "17:30",
          close: `${pad2(closeHour)}:00`,
          clean_done: `${pad2(cleanHour)}:00`
        }
      },
      shifts,     // front + standby
      quarters    // per-kwartier need/planned/omzet (ter visualisatie/controle)
    });
  } catch (err: any) {
    console.error("shifts-mw error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
