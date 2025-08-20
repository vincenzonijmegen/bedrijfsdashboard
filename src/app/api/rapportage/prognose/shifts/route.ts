import { NextRequest, NextResponse } from "next/server";
import { dbRapportage } from "@/lib/dbRapportage";

export const runtime = "nodejs";

/* ==== helpers ==== */
const pad2 = (n: number) => String(n).padStart(2, "0");
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function toDateISO(s: string) {
  const d = new Date(s + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) throw new Error("Ongeldige datum: " + s);
  return d;
}
function isWeekend(d: Date) {
  const iso = ((d.getUTCDay() + 6) % 7) + 1; // 1=Mon..7=Sun
  return iso >= 6;
}
function takeFirstNumeric(v: string | null, def: number): number {
  if (v == null) return def;
  const first = String(v).split(":")[0].trim();
  const n = Number(first);
  return Number.isFinite(n) ? n : def;
}
function parseBinaryParam(v: string | null, def = 0) {
  const n = takeFirstNumeric(v, def);
  return n === 1 ? 1 : 0;
}
function parseWeekday(val: string | null): number | null {
  if (!val) return null;
  const s = val.toLowerCase();
  const map: Record<string, number> = {
    ma:1, maa:1, maandag:1, mon:1, monday:1,
    di:2, din:2, dinsdag:2, tue:2, tuesday:2,
    wo:3, woe:3, woensdag:3, wed:3, wednesday:3,
    do:4, don:4, donderdag:4, thu:4, thursday:4,
    vr:5, vri:5, vrijdag:5, fri:5, friday:5,
    za:6, zat:6, zaterdag:6, sat:6, saturday:6,
    zo:7, zon:7, zondag:7, sun:7, sunday:7,
    feestdag:7
  };
  if (map[s] !== undefined) return map[s];
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 && n <= 7 ? n : null;
}
function qToTime(blockStartHour: number, qIdx: number) {
  const mins = Math.round(blockStartHour * 60 + qIdx * 15);
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return `${pad2(hh)}:${pad2(mm)}`;
}

/* ==== route ==== */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const now = new Date();

  // algemene params
  const jaar = takeFirstNumeric(searchParams.get("jaar"), now.getFullYear());
  const groei = Number(searchParams.get("groei") ?? "1.03");

  const norm = takeFirstNumeric(searchParams.get("norm"), 100);             // € per medewerker per kwartier
  const costPerQ = takeFirstNumeric(searchParams.get("cost_per_q"), 3.75);  // €15/u front
  const keukenBasis = parseBinaryParam(searchParams.get("keuken_basis"), 0); // 0/1 – telt mee in kosten

  const standbyDayStartStr = (searchParams.get("standby_day_start") ?? "14:00").trim();
  const standbyEveStartStr = (searchParams.get("standby_eve_start") ?? "19:00").trim();
  const maxShiftHours = takeFirstNumeric(searchParams.get("max_shift_hours"), 6);

  // detecteer modus
  const maandParam = searchParams.get("maand");
  const weekdagParam = searchParams.get("weekdag") ?? searchParams.get("weekday") ?? searchParams.get("wd");
  const maand = maandParam ? takeFirstNumeric(maandParam, 0) : 0;
  const isoWd = parseWeekday(weekdagParam);
  const useMonthWeekday = !!(maand && isoWd);

  // gemeenschappelijke packer-helpers
  const costFront = costPerQ;
  const costKeuken = 5.0; // €20/u => €5/kw
  type Shift = { role: "front" | "standby"; start: string; end: string; count: number };

  /* ===== MODE A: month × weekday ===== */
  if (useMonthWeekday) {
    try {
      const isSunday = isoWd === 7;
      const openHour = maand === 3 ? (isSunday ? 13 : 12) : (isSunday ? 13 : 12);
      const closeHour = maand === 3 ? 20 : 22;
      const cleanHour = maand === 3 ? 21 : 23;
      const coverageStartHour = isSunday ? 12.5 : 11.5; // 12:30 of 11:30
      const splitHour = 17.5;

      const sqlMW = `
        WITH
        hist_day AS (
          SELECT
            k.datum::date AS datum,
            EXTRACT(YEAR FROM k.datum)::int AS jaar,
            EXTRACT(MONTH FROM k.datum)::int AS maand,
            EXTRACT(ISODOW FROM k.datum)::int AS isodow,
            SUM(k.omzet) AS dag_omzet
          FROM rapportage.omzet_kwartier k
          GROUP BY 1,2,3,4
        ),
        month_year_totals AS (
          SELECT jaar, maand, SUM(dag_omzet) AS maand_omzet
          FROM hist_day GROUP BY 1,2
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
        weekday_weight AS (
          SELECT maand, isodow, AVG(dag_omzet) AS avg_dag_omzet
          FROM hist_day GROUP BY 1,2
        ),
        weekday_share AS (
          SELECT maand, isodow, avg_dag_omzet,
                 SUM(avg_dag_omzet) OVER (PARTITION BY maand) AS month_sum
          FROM weekday_weight
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
            $3::int AS maand,
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
        quarters_open AS (
          SELECT
            gs.ts,
            EXTRACT(HOUR FROM gs.ts)::int AS uur,
            (FLOOR(EXTRACT(MINUTE FROM gs.ts)::int / 15) + 1)::int AS kwartier
          FROM (
            SELECT generate_series(
              make_timestamp($1::int, $3::int, 1,
                             CASE WHEN $4::int = 7 THEN 13 ELSE 12 END, 0, 0),
              make_timestamp($1::int, $3::int, 1,
                             CASE WHEN $5::int = 1 THEN 20 ELSE 22 END, 0, 0),
              '15 min'
            ) AS ts
          ) gs
        ),
        hist_day_mw AS (
          SELECT
            EXTRACT(MONTH FROM k.datum)::int AS maand,
            EXTRACT(ISODOW FROM k.datum)::int AS isodow,
            k.uur, k.kwartier,
            AVG(k.omzet / NULLIF(d.dag_omzet,0)) AS q_pct
          FROM rapportage.omzet_kwartier k
          JOIN hist_day d ON d.datum = k.datum
          WHERE EXTRACT(MONTH FROM k.datum)::int = $3::int
            AND EXTRACT(ISODOW FROM k.datum)::int = $4::int
          GROUP BY 1,2,3,4
        ),
        q_with_pct AS (
          SELECT q.uur, q.kwartier, COALESCE(h.q_pct,0) AS q_pct_raw
          FROM quarters_open q
          LEFT JOIN hist_day_mw h
            ON h.maand = $3::int AND h.isodow = $4::int AND h.uur = q.uur AND h.kwartier = q.kwartier
        ),
        q_norm AS (
          SELECT uur, kwartier,
                 CASE WHEN SUM(q_pct_raw) OVER () > 0
                      THEN q_pct_raw / SUM(q_pct_raw) OVER ()
                      ELSE 1.0 / NULLIF(COUNT(*) OVER (), 0)
                 END AS q_share
          FROM q_with_pct
        ),
        forecast_quarter AS (
          SELECT uur, kwartier,
                 (SELECT dag_omzet_forecast FROM day_forecast) * q_share AS omzet_forecast
          FROM q_norm
        )
        SELECT
          uur, kwartier,
          omzet_forecast,
          CEIL(omzet_forecast / $6::numeric) AS need_front
        FROM forecast_quarter
        ORDER BY uur, kwartier;
      `;

      // $1 jaar, $2 groei, $3 maand, $4 isoWeekday, $5 isMarchFlag, $6 norm
      const raw = await dbRapportage.query(sqlMW, [jaar, groei, maand, isoWd, maand === 3 ? 1 : 0, norm]);
      type RowMW = { uur: number; kwartier: number; omzet_forecast: number; need_front: number };
      const rows: RowMW[] = raw.rows.map((r:any)=>({
        uur: Number(r.uur),
        kwartier: Number(r.kwartier),
        omzet_forecast: Math.max(0, Number(r.omzet_forecast) || 0),
        need_front: Math.max(1, Number(r.need_front) || 1),
      }));

      // coverage 11:30/12:30 .. clean
      const qStart = Math.round((isSunday ? 12.5 : 11.5) * 4);
      const qOpen  = Math.round(openHour * 4);
      const qClose = Math.round(closeHour * 4);
      const qClean = Math.round(cleanHour * 4);
      const totalQ = qClean - qStart;

      const need: number[] = new Array(totalQ).fill(1);
      const omzet: number[] = new Array(totalQ).fill(0);

      for (let absQ = qOpen; absQ < qClose; absQ++) {
        const h = Math.floor(absQ/4), k=(absQ%4)+1;
        const m = rows.find(x=> x.uur===h && x.kwartier===k);
        const idx = absQ - qStart;
        if (idx>=0 && idx<totalQ) {
          need[idx] = Math.max(1, m?.need_front ?? 1);
          omzet[idx] = Math.max(0, m?.omzet_forecast ?? 0);
        }
      }

      // packen per blok
      const splitQ = Math.round(17.5 * 4);
      const planned = new Array(totalQ).fill(0);
      const shifts: Shift[] = [];
      const minQ = 12; // 3u
      const maxQ = maxShiftHours > 0 ? maxShiftHours * 4 : Number.POSITIVE_INFINITY;

      function budgetOK(start:number,end:number,add:number){
        for(let i=start;i<end;i++){
          const budget = 0.23 * omzet[i];
          const cost = (planned[i]+add)*costFront + keukenBasis*costKeuken;
          if (cost > budget + 1e-6) return false;
        }
        return true;
      }
      function addFront(blockStartHour:number, startLocal:number, endLocal:number, count:number){
        if (count<=0 || endLocal<=startLocal) return;
        shifts.push({ role:"front", start:qToTime(blockStartHour, startLocal), end:qToTime(blockStartHour, endLocal), count });
        for(let i=startLocal;i<endLocal;i++) planned[i]+=count;
      }
      function fillBlock(absStartQ:number, absEndQ:number, blockStartHour:number){
        const s = absStartQ - qStart, e = absEndQ - qStart;
        // baseline 1
        addFront(blockStartHour, 0, e - s, 1);
        while(true){
          let first=-1; for(let i=s;i<e;i++){ if(planned[i]<need[i]){first=i;break;} }
          if (first===-1) break;
          let start=first, end=Math.min(start+minQ,e);
          if(end-start<minQ){ start=Math.max(s, e-minQ); end=Math.min(start+minQ, e); }
          let gap=0; for(let i=start;i<end;i++) gap=Math.max(gap, need[i]-planned[i]);
          let add=Math.max(1,gap);
          while(add>0 && !budgetOK(start,end,add)) add--;
          if(add<=0){ planned[start]=Math.max(planned[start],need[start]); continue; }
          addFront(blockStartHour, start - s, end - s, add);
        }
      }

      // blokken: [coverage..17:30) en [17:30..clean]
      fillBlock(qStart, Math.min(splitQ,qClean), isSunday ? 12.5 : 11.5);
      fillBlock(Math.min(splitQ,qClean), qClean, 17.5);

      // standby beide blokken
      const [sdH, sdM] = standbyDayStartStr.split(":").map(Number);
      const dayStandbyStartHour = (Number.isFinite(sdH)?sdH:14) + ((Number.isFinite(sdM)?sdM:0)/60);
      const dayStandbyAbsQ = Math.max(qStart, Math.round(dayStandbyStartHour*4));
      if (Math.min(splitQ,qClean) > dayStandbyAbsQ) {
        shifts.push({ role:"standby", start:qToTime(isSunday?12.5:11.5, dayStandbyAbsQ - qStart), end:qToTime(isSunday?12.5:11.5, Math.min(splitQ,qClean) - qStart), count:1 });
      }

      const [seH, seM] = standbyEveStartStr.split(":").map(Number);
      const eveStandbyStartHour = (Number.isFinite(seH)?seH:19) + ((Number.isFinite(seM)?seM:0)/60);
      const eveStandbyAbsQ = Math.max(Math.round(17.5*4), Math.round(eveStandbyStartHour*4));
      if (qClean > eveStandbyAbsQ) {
        shifts.push({ role:"standby", start:qToTime(isSunday?12.5:11.5, eveStandbyAbsQ - qStart), end:qToTime(isSunday?12.5:11.5, qClean - qStart), count:1 });
      }

      // quarters output
      const quarters = Array.from({length: totalQ}, (_,i)=>{
        const mins = (isSunday?12.5:11.5)*60 + i*15;
        const h = Math.floor(mins/60), m = mins%60;
        return {
          time: `${pad2(h)}:${pad2(m)}`,
          need: need[i],
          planned: planned[i],
          omzet: Number(omzet[i]?.toFixed(2) ?? "0"),
          budget: Number((0.23*omzet[i])?.toFixed(2) ?? "0"),
          cost_front: Number((planned[i]*costFront + keukenBasis*costKeuken)?.toFixed(2) ?? "0")
        };
      });

      return NextResponse.json({
        ok: true,
        mode: "month-weekday",
        params: {
          jaar, groei, maand, weekdag: isoWd, norm, costPerQ, keukenBasis,
          coverage: {
            start: `${pad2(Math.floor(isSunday?12.5:11.5))}:${pad2(((isSunday?12.5:11.5)%1)*60||0)}`,
            open: `${pad2(openHour)}:00`,
            split: "17:30",
            close: `${pad2(closeHour)}:00`,
            clean_done: `${pad2(cleanHour)}:00`
          }
        },
        shifts,
        quarters
      });
    } catch (err:any) {
      console.error("shifts month-weekday error:", err);
      return NextResponse.json({ ok:false, stage:"month-weekday-sql-or-pack", error: err.message }, { status: 500 });
    }
  }

  /* ===== MODE B: date range ===== */
  try {
    const startParam = searchParams.get("start");
    const eindeParam = searchParams.get("einde");
    const startDate = startParam && eindeParam ? toDateISO(startParam) : toDateISO(`${jaar}-01-01`);
    const endDate   = startParam && eindeParam ? toDateISO(eindeParam)   : toDateISO(`${jaar}-12-31`);

    const sqlRange = `
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
        SELECT datum, uur, kwartier, omzet_forecast,
               CEIL(omzet_forecast / $2::numeric) AS behoefte_medewerkers,
               FLOOR((omzet_forecast * 0.23) / $3::numeric) AS max_medewerkers
        FROM forecast_quarter
      )
      SELECT datum, uur, kwartier, omzet_forecast,
             LEAST(max_medewerkers, behoefte_medewerkers) AS front_needed
      FROM staffing
      WHERE datum BETWEEN $4::date AND $5::date
      ORDER BY datum, uur, kwartier;
    `;

    const raw = await dbRapportage.query(sqlRange, [
      jaar,           // $1
      norm,           // $2
      costPerQ,       // $3
      isoDate(startDate), // $4
      isoDate(endDate),   // $5
    ]);

    type Row = { datum: string; uur: number; kwartier: number; omzet_forecast: number; front_needed: number };
    const rows: Row[] = raw.rows.map((r:any)=>({
      datum: typeof r.datum === "string" ? r.datum : new Date(r.datum).toISOString().slice(0,10),
      uur: Number(r.uur),
      kwartier: Number(r.kwartier),
      omzet_forecast: Math.max(0, Number(r.omzet_forecast)||0),
      front_needed: Math.max(0, Number(r.front_needed)||0),
    }));

    const byDate: Record<string, Row[]> = {};
    for (const r of rows) (byDate[r.datum] ||= []).push(r);

    function planDay(dateISO:string, month:number, wknd:boolean) {
      const openHour  = month === 3 ? (wknd ? 13 : 12) : (wknd ? 13 : 12);
      const closeHour = month === 3 ? 20 : 22;
      const cleanHour = month === 3 ? 21 : 23;

      const dayStartHour = openHour - 0.5; // 30m opstart
      const splitHour = 17.5;

      const qStart = Math.round(dayStartHour*4);
      const qOpen  = Math.round(openHour*4);
      const qEnd   = Math.round(cleanHour*4);
      const qSplit = Math.round(splitHour*4);
      const totalQ = qEnd - qStart;

      const dayRows = byDate[dateISO] || [];
      const need:number[] = new Array(totalQ).fill(1);
      const omzet:number[] = new Array(totalQ).fill(0);

      for (let absQ=qOpen; absQ<qEnd; absQ++){
        const h = Math.floor(absQ/4), k=(absQ%4)+1;
        const rr = dayRows.find(x=> x.uur===h && x.kwartier===k);
        const idx = absQ - qStart;
        if (idx>=0 && idx<totalQ){
          need[idx] = Math.max(1, rr?.front_needed ?? 1);
          omzet[idx] = Math.max(0, rr?.omzet_forecast ?? 0);
        }
      }

      const planned = new Array(totalQ).fill(0);
      const shifts: Shift[] = [];
      const minQ = 12;
      const maxQ = maxShiftHours>0 ? maxShiftHours*4 : Number.POSITIVE_INFINITY;

      function budgetOK(start:number,end:number,add:number){
        for(let i=start;i<end;i++){
          const budget = 0.23*omzet[i];
          const cost = (planned[i]+add)*costFront + keukenBasis*costKeuken;
          if (cost > budget + 1e-6) return false;
        }
        return true;
      }
      function addFront(blockStartHour:number, startLocal:number, endLocal:number, count:number){
        if (count<=0 || endLocal<=startLocal) return;
        shifts.push({ role:"front", start:qToTime(blockStartHour,startLocal), end:qToTime(blockStartHour,endLocal), count });
        for(let i=startLocal;i<endLocal;i++) planned[i]+=count;
      }
      function fillBlock(absStartQ:number, absEndQ:number, blockStartHour:number){
        const s = absStartQ - qStart, e = absEndQ - qStart;
        // baseline 1
        addFront(blockStartHour, 0, e - s, 1);
        while(true){
          let first=-1; for(let i=s;i<e;i++){ if(planned[i]<need[i]){first=i;break;} }
          if (first===-1) break;
          let start=first, end=Math.min(start+minQ,e);
          if(end-start<minQ){ start=Math.max(s, e-minQ); end=Math.min(start+minQ, e); }
          let gap=0; for(let i=start;i<end;i++) gap=Math.max(gap, need[i]-planned[i]);
          let add=Math.max(1,gap);
          while(add>0 && !budgetOK(start,end,add)) add--;
          if(add<=0){ planned[start]=Math.max(planned[start],need[start]); continue; }
          addFront(blockStartHour, start - s, end - s, add);
        }
      }

      fillBlock(qStart, Math.min(qSplit,qEnd), dayStartHour);
      fillBlock(Math.min(qSplit,qEnd), qEnd, 17.5);

      // standby in beide blokken
      shifts.push({ role:"standby", start:"14:00", end:"17:30", count:1 });
      shifts.push({ role:"standby", start:"19:00", end: month===3 ? "21:00" : "23:00", count:1 });

      return { date: dateISO, open:`${pad2(openHour)}:00`, close:`${pad2(closeHour)}:00`, clean_done:`${pad2(cleanHour)}:00`, shifts };
    }

    const out:any[] = [];
    for (let d = startDate; d <= endDate; d = new Date(d.getTime()+86400000)){
      const iso = isoDate(d);
      if (byDate[iso]) out.push(planDay(iso, d.getUTCMonth()+1, isWeekend(d)));
    }

    return NextResponse.json({
      ok: true,
      mode: "date-range",
      range: { start: isoDate(startDate), einde: isoDate(endDate) },
      params: { jaar, norm, costPerQ, keukenBasis },
      days: out
    });
  } catch (err:any) {
    console.error("shifts date-range error:", err);
    return NextResponse.json({ ok:false, stage:"date-range-sql-or-pack", error: err.message }, { status: 500 });
  }
}
