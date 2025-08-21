// src/app/api/rapportage/profielen/overzicht/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/* ---------------- types & helpers ---------------- */

type ProfRow = {
  isodow: number;         // 1=ma .. 7=zo
  uur: number;            // 0..23
  kwartier: number;       // 1..4
  omzet_avg: number;      // gemiddelde kwartieromzet (raw)
  q_share_avg: number | null; // aandeel van dit kwartier in dagomzet (0..1), gemiddeld
  day_avg: number | null; // gemiddelde dagomzet (maand×isodow)
};

const WD_NL = ["", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];
const MONTH_NL = ["", "januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];

const PAD = (n: number) => String(n).padStart(2, "0");

function labelFor(startHour: number, minutes: number) {
  const h1 = Math.floor(startHour);
  const m1 = Math.round((startHour - h1) * 60);
  const mEnd = m1 + minutes;
  const h2 = h1 + Math.floor(mEnd / 60);
  const mm2 = mEnd % 60;
  return `${PAD(h1)}:${PAD(m1)} - ${PAD(h2)}:${PAD(mm2)}`;
}

function opening(maand: number, isodow: number) {
  // Verkoopuren (zonder opstart/schoonmaak)
  if (maand === 3) return { openHour: isodow === 7 ? 13 : 12, closeHour: 20, cleanHour: 21 };
  return { openHour: isodow === 7 ? 13 : 12, closeHour: 22, cleanHour: 23 };
}

function cleanHourForMonth(maand: number) {
  return maand === 3 ? 21 : 23; // 1h na sluit
}

function slotStartHour(uur: number, kwartier: number) {
  // kwartier 1..4 => offset 0, 0.25, 0.5, 0.75 uur
  return uur + (kwartier - 1) * 0.25;
}

function blocksBetween(startHour: number, endHour: number, blockMinutes: number) {
  const unitsPerHour = 60 / blockMinutes;
  return Math.max(0, Math.round((endHour - startHour) * unitsPerHour));
}

function countWeekdaysInMonth(year: number, month1to12: number, isodow: number) {
  let cnt = 0;
  const start = new Date(Date.UTC(year, month1to12 - 1, 1));
  const end = new Date(Date.UTC(year, month1to12, 0));
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
    const iso = (((d.getUTCDay() + 6) % 7) + 1);
    if (iso === isodow) cnt++;
  }
  return cnt;
}

/* ---------------------- route ---------------------- */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    /* -------- parameters -------- */
    const maand = Number(searchParams.get("maand") || "0");
    if (!Number.isInteger(maand) || maand < 1 || maand > 12) {
      return NextResponse.json({ ok: false, error: "Geef ?maand=1..12 mee." }, { status: 400 });
    }

    const blockMinutes = Number(searchParams.get("block_minutes") || "15");
    const blockFactor = blockMinutes === 30 ? 2 : 1;
    if (blockMinutes !== 15 && blockMinutes !== 30) {
      return NextResponse.json({ ok: false, error: "block_minutes moet 15 of 30 zijn." }, { status: 400 });
    }

    const robustOn = searchParams.get("robust") === "1";
    const winsorAlpha = Number(searchParams.get("winsor_alpha") || "0.10"); // 10%

    const includeStaff = searchParams.get("show_staff") === "1";
    const jaar = Number(searchParams.get("jaar") || new Date().getFullYear());
    const groei = Number(searchParams.get("groei") || "1.03");

    // kosten/norm per 15 minuten — DEFAULTS: front 3.75, keuken 5.00
    const normRevQ   = Number(searchParams.get("norm")       || "100");  // € omzet / med / 15m
    const costPerQ   = Number(searchParams.get("cost_per_q") || "3.75"); // € / 15m front (all-in)
    const itemsPerQ  = Number(searchParams.get("items_per_q")|| "10");   // items / med / 15m

    // keuken-baseline
    const kitchenDayStartStr = (searchParams.get("kitchen_day_start") || "10:00").trim();
    const [kdsH, kdsM] = kitchenDayStartStr.split(":").map(Number);
    const kitchenDayStart = (Number.isFinite(kdsH) ? kdsH : 10) + ((Number.isFinite(kdsM) ? kdsM : 0) / 60);
    const kitchenDayCount = Number(searchParams.get("kitchen_day_count") || "1");
    const kitchenEveCount = Number(searchParams.get("kitchen_eve_count") || "1");
    const kitchenCostPerQ = Number(searchParams.get("kitchen_cost_per_q") || "5"); // € / 15m keuken (all-in)

    // opstart/schoonmaak
    const preMinutes   = Number(searchParams.get("open_lead_minutes")  || "30");
    const postMinutes  = Number(searchParams.get("close_trail_minutes")|| "60");
    const startupFront = Number(searchParams.get("startup_front_count")|| "1"); // 2 totaal incl 1 keuken => 1 front
    const cleanFront   = Number(searchParams.get("clean_front_count")  || "2"); // 3 totaal incl 1 keuken => 2 front

    // (voorheen budget_mode) — unified methode; waarde genegeerd
    // bezettingscurve parameters kunnen later gebruikt worden voor occ-tuning (optioneel)

    /* -------- DB -------- */
    const mod = await import("@/lib/dbRapportage");
    const db = mod.dbRapportage;

    // 1) Profiel-kwartieren (raw + q_share_avg + daggemiddelde) voor geselecteerde maand
    const sqlMonthRows = `
      SELECT p.isodow::int, p.uur::int, p.kwartier::int,
             p.omzet_avg::numeric,
             COALESCE(p.q_share_avg, NULL)::numeric AS q_share_avg,
             (SELECT AVG(dagomzet_avg) FROM rapportage.omzet_profiel_mw_kwartier x
               WHERE x.maand = p.maand AND x.isodow = p.isodow) AS day_avg
      FROM rapportage.omzet_profiel_mw_kwartier p
      WHERE p.maand = $1
      ORDER BY p.isodow, p.uur, p.kwartier;
    `;
    const rs = await db.query(sqlMonthRows, [maand]);
    const rows: ProfRow[] = rs.rows.map((r: any) => ({
      isodow: Number(r.isodow),
      uur: Number(r.uur),
      kwartier: Number(r.kwartier),
      omzet_avg: Number(r.omzet_avg || 0),
      q_share_avg: r.q_share_avg !== null ? Number(r.q_share_avg) : null,
      day_avg: r.day_avg !== null ? Number(r.day_avg) : null,
    }));

    const byDay = new Map<number, ProfRow[]>();
    rows.forEach((r) => {
      if (!byDay.has(r.isodow)) byDay.set(r.isodow, []);
      byDay.get(r.isodow)!.push(r);
    });

    // 2) Winsorized uur-mean per isodow×uur (alle jaren in deze maand)
    const robustHourMap: Record<number, Record<number, number>> = {};
    if (robustOn) {
      const sqlWinsorHours = `
        WITH base AS (
          SELECT
            o.datum::date                     AS d,
            EXTRACT(MONTH FROM o.datum)::int  AS m,
            EXTRACT(ISODOW FROM o.datum)::int AS isodow,
            o.uur::int                        AS uur,
            SUM(o.omzet)::numeric             AS omzet_uur
          FROM rapportage.omzet_kwartier o
          WHERE EXTRACT(MONTH FROM o.datum)::int = $1
          GROUP BY 1,2,3,4
        ),
        b AS (SELECT isodow, uur, omzet_uur FROM base WHERE m = $1),
        bounds AS (
          SELECT isodow, uur,
                 PERCENTILE_CONT($2)   WITHIN GROUP (ORDER BY omzet_uur) AS p_low,
                 PERCENTILE_CONT(1-$2) WITHIN GROUP (ORDER BY omzet_uur) AS p_high
          FROM b GROUP BY isodow, uur
        ),
        winsored AS (
          SELECT b.isodow, b.uur, GREATEST(LEAST(b.omzet_uur, bo.p_high), bo.p_low) AS w
          FROM b JOIN bounds bo USING (isodow, uur)
        )
        SELECT isodow::int, uur::int, AVG(w)::numeric AS winsor_mean
        FROM winsored
        GROUP BY isodow, uur
        ORDER BY isodow, uur;
      `;
      const wr = await db.query(sqlWinsorHours, [maand, winsorAlpha]);
      for (const r of wr.rows) {
        const d = Number(r.isodow);
        if (!robustHourMap[d]) robustHourMap[d] = {};
        robustHourMap[d][Number(r.uur)] = Number(r.winsor_mean || 0);
      }
    }

    // 3) Gem. €/item per maand (voor capaciteit)
    const avgItemRs = await db.query(
      `SELECT COALESCE(SUM(aantal),0) AS items, COALESCE(SUM(aantal*eenheidsprijs),0) AS omzet
       FROM rapportage.omzet WHERE EXTRACT(MONTH FROM datum)::int = $1`, [maand]
    );
    const totItems = Number(avgItemRs.rows[0]?.items || 0);
    const totOmzet = Number(avgItemRs.rows[0]?.omzet || 0);
    const avgItemRevMonth = totItems > 0 ? (totOmzet / totItems) : 0;

    /* ---------- Groei-schaalfactor voor omzet (rev_scale) ---------- */
    let revScale = 1;
    let yearPrev = 0;
    let yearTarget = 0;
    {
      const prev = await db.query(
        `SELECT COALESCE(SUM(aantal * eenheidsprijs),0) AS y
         FROM rapportage.omzet
         WHERE EXTRACT(YEAR FROM datum)::int = $1`, [jaar - 1]
      );
      yearPrev   = Number(prev.rows[0]?.y || 0);
      yearTarget = Math.round(yearPrev * (isFinite(groei) && groei > 0 ? groei : 1));

      // Basis-jaaromzet uit profielen (alle maanden/weekdagen) – ter schaling
      const mexp = await db.query(`
        WITH day_avg AS (
          SELECT maand, isodow, AVG(dagomzet_avg)::numeric AS day_avg
          FROM rapportage.omzet_profiel_mw_kwartier
          GROUP BY maand, isodow
        ),
        day_counts AS (
          SELECT EXTRACT(MONTH FROM d)::int AS maand,
                 EXTRACT(ISODOW FROM d)::int AS isodow,
                 COUNT(*)::int AS n_days
          FROM generate_series(make_date($1,1,1), make_date($1,12,31), '1 day') d
          GROUP BY 1,2
        )
        SELECT SUM(COALESCE(da.day_avg,0) * dc.n_days)::numeric AS base_year_exp
        FROM day_counts dc
        LEFT JOIN day_avg da ON da.maand = dc.maand AND da.isodow = dc.isodow
      `, [jaar]);
      const baseYearExp = Number(mexp.rows[0]?.base_year_exp || 0);
      revScale = baseYearExp > 0 ? (yearTarget / baseYearExp) : 1;
    }

    /* ---------- Slots (preopen + sales + clean) voor GEVRAAGDE maand ---------- */
    const weekdays: Array<{
      isodow: number;
      naam: string;
      open: string;
      close: string;
      slots: Array<{
        from_to: string;
        uur: number;
        block_minutes: number;
        kwartier?: number;
        block?: number;
        slot_type: "preopen" | "sales" | "clean";
        omzet_avg: number;
        omzet_avg_robust?: number;
        unit_cost_front?: number;
        kitchen_cost_this_slot?: number;
        staff_norm?: number;
        staff_capacity?: number;
        staff_budget_cap?: number;
        staff_plan?: number;
        over_budget?: boolean;
        budget_gap_eur?: number;
      }>;
    }> = [];

    for (let d = 1; d <= 7; d++) {
      const { openHour, closeHour } = opening(maand, d);
      const cleanHour = cleanHourForMonth(maand);
      const salesRows = (byDay.get(d) || []).filter(r => r.uur >= openHour && r.uur < closeHour);

      // som per uur voor sales (raw)
      const hourSumRaw: Record<number, number> = {};
      const hourQRaw: Record<number, number[]> = {};
      for (const r of salesRows) {
        hourSumRaw[r.uur] = (hourSumRaw[r.uur] || 0) + (r.omzet_avg || 0);
        (hourQRaw[r.uur] ||= [0,0,0,0])[r.kwartier - 1] = r.omzet_avg || 0;
      }

      const slots: any[] = [];

      // A) pre-open
      if (preMinutes > 0) {
        const preStart = openHour - preMinutes / 60;
        for (let start = preStart; start < openHour - 1e-9; start += blockMinutes / 60) {
          slots.push({
            from_to: labelFor(start, blockMinutes),
            uur: Math.floor(start),
            block_minutes: blockMinutes,
            slot_type: "preopen" as const,
            omzet_avg: 0
          });
        }
      }

      // B) sales
      for (let h = openHour; h < closeHour; h++) {
        const qs = hourQRaw[h] || [0,0,0,0];
        const hourTotalRaw = hourSumRaw[h] || 0;
        const winsorHour   = robustOn ? (robustHourMap[d]?.[h] ?? 0) : 0;

        if (blockMinutes === 15) {
          for (let q = 1; q <= 4; q++) {
            const raw = qs[q - 1] || 0;
            const rob = robustOn ? (hourTotalRaw > 0 ? winsorHour * (raw / hourTotalRaw) : winsorHour / 4) : undefined;
            slots.push({
              from_to: labelFor(slotStartHour(h, q), 15),
              uur: h,
              kwartier: q,
              block_minutes: 15,
              slot_type: "sales" as const,
              omzet_avg: raw,
              ...(robustOn ? { omzet_avg_robust: Number((rob || 0).toFixed(2)) } : {})
            });
          }
        } else {
          // 30-min blokken: q1+q2 en q3+q4
          const rawA = (qs[0]||0) + (qs[1]||0);
          const rawB = (qs[2]||0) + (qs[3]||0);
          const wA = hourTotalRaw > 0 ? rawA / hourTotalRaw : 0.5;
          const wB = 1 - wA;
          const robA = robustOn ? winsorHour * wA : undefined;
          const robB = robustOn ? winsorHour * wB : undefined;

          slots.push({
            from_to: labelFor(h, 30),
            uur: h,
            block: 1,
            block_minutes: 30,
            slot_type: "sales" as const,
            omzet_avg: rawA,
            ...(robustOn ? { omzet_avg_robust: Number((robA || 0).toFixed(2)) } : {})
          });
          slots.push({
            from_to: labelFor(h + 0.5, 30),
            uur: h,
            block: 2,
            block_minutes: 30,
            slot_type: "sales" as const,
            omzet_avg: rawB,
            ...(robustOn ? { omzet_avg_robust: Number((robB || 0).toFixed(2)) } : {})
          });
        }
      }

      // C) clean
      if (postMinutes > 0) {
        const wantedEnd = closeHour + postMinutes / 60;
        const end = Math.min(cleanHour, wantedEnd);
        for (let start = closeHour; start < end - 1e-9; start += blockMinutes / 60) {
          slots.push({
            from_to: labelFor(start, blockMinutes),
            uur: Math.floor(start),
            block_minutes: blockMinutes,
            slot_type: "clean" as const,
            omzet_avg: 0
          });
        }
      }

      // D) keuken-kosten per slot + unit front cost
      const unitFront = costPerQ * blockFactor;
      const unitKitchen = kitchenCostPerQ * blockFactor;

      for (const s of slots) {
        const hh = Number(s.from_to.slice(0,2));
        const mm = Number(s.from_to.slice(3,5));
        const startH = hh + mm/60;

        const inDay = startH >= kitchenDayStart && startH < 17.5;
        const inEve = startH >= 17.5 && startH < cleanHourForMonth(maand);
        const kCostThis = (inDay ? kitchenDayCount : 0) * unitKitchen
                        + (inEve ? kitchenEveCount : 0) * unitKitchen;

        s.kitchen_cost_this_slot = Number(kCostThis.toFixed(2));
        s.unit_cost_front = unitFront;
      }

      // E) personeel + unified budgettering
      const normPerUnit = normRevQ * blockFactor;
      const capRevPerStaffUnit = (itemsPerQ * blockFactor) * avgItemRevMonth;

      if (includeStaff) {
        // unified methode (baseline-first top-down + need-share + lokale 23% cap), groei via revScale

        // 1) dag-salesbudget — we bepalen het *verhoudingsgewijs* binnen de maand (zonder harde occ-parameters; dagprofiel dicteert)
        const listForDay = (byDay.get(d) || []);
        const dayAvg = listForDay.length ? (listForDay[0].day_avg ?? 0) : 0;

        // Totale dagomzet-schaal in deze maand
        const monthDayTotals: number[] = [];
        for (let iso=1; iso<=7; iso++){
          const da = (byDay.get(iso) || [])[0]?.day_avg || 0;
          const nd = countWeekdaysInMonth(jaar, maand, iso);
          monthDayTotals.push(da*nd);
        }
        const sumMonthDays = monthDayTotals.reduce((a,b)=>a+b,0);
        const nDaysThis = countWeekdaysInMonth(jaar, maand, d);

        // We stellen een *verdelingspot* afgeleid van jaar-target: 23% × yearTarget × (verhouding maand/dag)
        // NB: Om lokale over- of onderschrijding te voorkomen, nemen we hier pragmatisch:
        // daySalesBudgetPot = 0.23 × (dayAvg × revScale)
        // (We laten baseline/NS buiten de blokverdeling; die worden toch los gepland met Bud=0.)
        const daySalesBudget = 0.23 * (dayAvg * revScale);

        // 2) need-proxy per sales-blok
        const salesSlots = slots.filter((x:any)=> x.slot_type==="sales");
        const needProxies = salesSlots.map((x:any)=>{
          const base = Number(robustOn && x.omzet_avg_robust!=null ? x.omzet_avg_robust : x.omzet_avg);
          const v = base * revScale; // groei toepassen
          const n  = normPerUnit>0        ? v / normPerUnit        : 0;
          const cap= capRevPerStaffUnit>0 ? v / capRevPerStaffUnit : 0;
          return Math.max(n, cap, 1e-6);
        });
        const needSum = needProxies.reduce((a,b)=>a+b,0);

        // 3) Bud per sales-blok = min( share_need*daySalesBudget,  23%*omzet_scal − keuken )
        salesSlots.forEach((s:any, idx:number)=>{
          const base = Number(robustOn && s.omzet_avg_robust!=null ? s.omzet_avg_robust : s.omzet_avg);
          const value = base * revScale;

          const shareNeed = needSum>0 ? (needProxies[idx]/needSum) : (1/salesSlots.length);
          const allowedFromDay = daySalesBudget * shareNeed;

          const front23 = Math.max(0, 0.23*value - Number(s.kitchen_cost_this_slot||0));

          const allowed = Math.min(allowedFromDay, front23);
          const bud = unitFront>0 ? Math.floor(allowed / unitFront) : 0;

          const staff_norm     = normPerUnit>0 ? Math.ceil(value / normPerUnit) : 0;
          const staff_capacity = capRevPerStaffUnit>0 ? Math.ceil(value / capRevPerStaffUnit) : 0;
          const need = Math.max(staff_norm, staff_capacity);
          const planRaw = Math.min(bud, need);
          const staff_plan = Math.max(1, planRaw);

          const over_budget = staff_plan > bud;
          const budget_gap_eur = over_budget ? Number((staff_plan*unitFront - bud*unitFront).toFixed(2)) : 0;

          s.staff_norm = staff_norm;
          s.staff_capacity = staff_capacity;
          s.staff_budget_cap = bud;
          s.staff_plan = staff_plan;
          s.over_budget = over_budget;
          s.budget_gap_eur = budget_gap_eur;
        });

        // 4) NS-blokken: geforceerd Plan, Bud=0, gap = plan*unitFront (valt onder baselinejaar)
        slots.filter((x:any)=>x.slot_type!=="sales").forEach((s:any)=>{
          const forcePlan = s.slot_type==="preopen" ? startupFront : cleanFront;
          s.staff_budget_cap = 0;
          s.staff_plan = Math.max(1, forcePlan);
          s.over_budget = s.staff_plan > 0;
          s.budget_gap_eur = Number((s.staff_plan*unitFront).toFixed(2));
        });
      }

      weekdays.push({
        isodow: d,
        naam: WD_NL[d],
        open: `${PAD(openHour)}:00`,
        close: `${PAD(closeHour)}:00`,
        slots,
      });
    }

    // staff_meta met rev_scale (altijd als staff aan staat)
    const staffMeta = includeStaff ? {
      jaar,
      groei,
      budget_mode: "unified",
      avg_item_rev_month: Number((totItems>0 ? totOmzet/totItems : 0).toFixed(4)),
      items_per_unit: itemsPerQ * blockFactor,
      unit_cost_front: costPerQ * blockFactor,
      unit_cost_kitchen: kitchenCostPerQ * blockFactor,
      startup_front_count: startupFront,
      clean_front_count: cleanFront,
      open_lead_minutes: preMinutes,
      close_trail_minutes: postMinutes,
      // groei-schaal (ook bruikbaar voor jaarcheck)
      year_prev_revenue: yearPrev,
      year_target_revenue: yearTarget,
      rev_scale: revScale,
    } : undefined;

    return NextResponse.json({
      ok: true,
      maand,
      maand_naam: MONTH_NL[maand],
      robust: robustOn ? { winsor_alpha: winsorAlpha } : undefined,
      block_minutes: blockMinutes,
      weekdays,
      staff_meta: staffMeta,
    });
  } catch (err: any) {
    console.error("profiel-overzicht error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
