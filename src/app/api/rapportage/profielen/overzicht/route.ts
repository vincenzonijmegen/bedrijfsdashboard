import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/* ---------------- helpers & types ---------------- */

type ProfRow = {
  isodow: number;            // 1=ma .. 7=zo
  uur: number;               // 0..23
  kwartier: number;          // 1..4
  omzet_avg: number;         // gemiddelde kwartieromzet (raw)
  q_share_avg: number | null;// aandeel van dit kwartier in dagomzet (0..1), gemiddeld
  day_avg: number | null;    // gemiddelde dagomzet (maand×isodow)
};

const WD_NL = ["", "maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag","zondag"];
const MONTH_NL = ["", "januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];

const PAD = (n: number) => String(n).padStart(2, "0");

// Alleen maart t/m september open
const isOpenMonth = (m: number) => m >= 3 && m <= 9;

function labelFor(startHour: number, minutes: number) {
  const h1 = Math.floor(startHour);
  const m1 = Math.round((startHour - h1) * 60);
  const mEnd = m1 + minutes;
  const h2 = h1 + Math.floor(mEnd / 60);
  const mm2 = mEnd % 60;
  return `${PAD(h1)}:${PAD(m1)} - ${PAD(h2)}:${PAD(mm2)}`;
}

function opening(maand: number, isodow: number) {
  if (!isOpenMonth(maand)) return { openHour: NaN, closeHour: NaN, cleanHour: NaN, closed: true as const };
  if (maand === 3) return { openHour: isodow === 7 ? 13 : 12, closeHour: 20, cleanHour: 21, closed: false as const };
  return { openHour: isodow === 7 ? 13 : 12, closeHour: 22, cleanHour: 23, closed: false as const };
}

function cleanHourForMonth(maand: number) { return maand === 3 ? 21 : 23; }
function slotStartHour(uur: number, kwartier: number) { return uur + (kwartier - 1) * 0.25; }
function blocksBetween(startHour: number, endHour: number, blockMinutes: number) {
  const unitsPerHour = 60 / blockMinutes;
  return Math.max(0, Math.round((endHour - startHour) * unitsPerHour));
}
function countWeekdaysInMonth(year: number, month1to12: number, isodow: number) {
  let cnt = 0;
  const start = new Date(Date.UTC(year, month1to12 - 1, 1));
  const end   = new Date(Date.UTC(year, month1to12, 0));
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
    const blockFactor  = blockMinutes === 30 ? 2 : 1;
    if (blockMinutes !== 15 && blockMinutes !== 30) {
      return NextResponse.json({ ok: false, error: "block_minutes moet 15 of 30 zijn." }, { status: 400 });
    }

    const robustOn    = searchParams.get("robust") === "1";   // (optie blijft voor compat; niet nodig voor shares)
    const winsorAlpha = Number(searchParams.get("winsor_alpha") || "0.10");

    const includeStaff = searchParams.get("show_staff") === "1";
    const jaar   = Number(searchParams.get("jaar")  || new Date().getFullYear());
    const groei  = Number(searchParams.get("groei") || "1.03");

    // Kosten/norm per 15m — defaults: front 3.75, keuken 5.00
    const normRevQ  = Number(searchParams.get("norm")        || "100");
    const costPerQ  = Number(searchParams.get("cost_per_q")  || "3.75");
    const itemsPerQ = Number(searchParams.get("items_per_q") || "10");

    // Keuken-baseline
    const kitchenDayStartStr = (searchParams.get("kitchen_day_start") || "10:00").trim();
    const [kdsH, kdsM]       = kitchenDayStartStr.split(":").map(Number);
    const kitchenDayStart    = (Number.isFinite(kdsH) ? kdsH : 10) + ((Number.isFinite(kdsM) ? kdsM : 0) / 60);
    const kitchenDayCount    = Number(searchParams.get("kitchen_day_count") || "1");
    const kitchenEveCount    = Number(searchParams.get("kitchen_eve_count") || "1");
    const kitchenCostPerQ    = Number(searchParams.get("kitchen_cost_per_q") || "5");

    // Opstart/schoonmaak (front-kant plannen we via staff_plan)
    const preMinutes   = Number(searchParams.get("open_lead_minutes")  || "30");
    const postMinutes  = Number(searchParams.get("close_trail_minutes")|| "60");
    const startupFront = Number(searchParams.get("startup_front_count")|| "1"); // front; total opstart=2 incl 1 keuken
    const cleanFront   = Number(searchParams.get("clean_front_count")  || "2"); // front; total schoonmaak=3 incl 1 keuken

    // Shifts: +min = later open; -min bij close = eerder dicht
    const openShiftMin  = Number(searchParams.get("open_shift_minutes")  || "0");
    const closeShiftMin = Number(searchParams.get("close_shift_minutes") || "0");

    // Alleen op deze ISO-weekdagen shifts toepassen (CSV "1,2,3,4,5,6"); leeg => alle dagen
    const applyShiftIsodowParam = (searchParams.get("apply_shift_isodow") || "").trim();
    const applyShiftSet: Set<number> | null = applyShiftIsodowParam
      ? new Set(
          applyShiftIsodowParam
            .split(",")
            .map(s => Number(s))
            .filter(n => Number.isInteger(n) && n >= 1 && n <= 7)
        )
      : null;

    /* -------- DB -------- */
    const mod = await import("@/lib/dbRapportage");
    const db  = mod.dbRapportage;

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
    const rs   = await db.query(sqlMonthRows, [maand]);
    const rows: ProfRow[] = rs.rows.map((r: any) => ({
      isodow     : Number(r.isodow),
      uur        : Number(r.uur),
      kwartier   : Number(r.kwartier),
      omzet_avg  : Number(r.omzet_avg || 0),
      q_share_avg: r.q_share_avg !== null ? Number(r.q_share_avg) : null,
      day_avg    : r.day_avg !== null ? Number(r.day_avg) : null,
    }));

    const byDay = new Map<number, ProfRow[]>();
    rows.forEach((r) => {
      if (!byDay.has(r.isodow)) byDay.set(r.isodow, []);
      byDay.get(r.isodow)!.push(r);
    });

    // (optioneel) winsor-info: niet nodig voor share-based; robustOn blijft voor compat in response
    if (robustOn) {
      await db.query("SELECT 1"); // noop to silence unused lint paths
    }

    // 3) Gem. €/item per maand (voor capaciteit)
    const avgItemRs = await db.query(
      `SELECT COALESCE(SUM(aantal),0) AS items,
              COALESCE(SUM(aantal*eenheidsprijs),0) AS omzet
       FROM rapportage.omzet_dag_product
       WHERE EXTRACT(MONTH FROM datum)::int = $1`,
      [maand]
    );
    const totItems        = Number(avgItemRs.rows[0]?.items || 0);
    const totOmzet        = Number(avgItemRs.rows[0]?.omzet || 0);
    const avgItemRevMonth = totItems > 0 ? (totOmzet / totItems) : 0; // € per item
    const capEURPerUnit   = (itemsPerQ * blockFactor) * avgItemRevMonth;

    /* ---------- Groei-schaalfactor voor omzet (rev_scale) ---------- */
    let revScale   = 1;
    let yearPrev   = 0;
    let yearTarget = 0;
    {
      const prev = await db.query(
        `SELECT COALESCE(SUM(aantal * eenheidsprijs),0) AS y
         FROM rapportage.omzet_dag_product
         WHERE EXTRACT(YEAR FROM datum)::int = $1`,
        [jaar - 1]
      );
      yearPrev   = Number(prev.rows[0]?.y || 0);
      yearTarget = Math.round(yearPrev * (isFinite(groei) && groei > 0 ? groei : 1));

      // Basisjaar uit profielen om te schalen (som dagavg × #dagen over alle maanden/weekdagen)
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
      revScale          = baseYearExp > 0 ? (yearTarget / baseYearExp) : 1;
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
        omzet_avg: number;           // share-based (onge-schaald)
        omzet_avg_robust?: number;   // idem, voor UI compat
        unit_cost_front?: number;
        kitchen_cost_this_slot?: number;
        staff_norm?: number;
        staff_capacity?: number;
        staff_budget_cap?: number;
        staff_plan?: number;
        over_budget?: boolean;
        budget_gap_eur?: number;
        __share?: number;            // intern
      }>;
    }> = [];

    // Gesloten maand: geen slots
    if (!isOpenMonth(maand)) {
      for (let d = 1; d <= 7; d++) {
        weekdays.push({ isodow: d, naam: WD_NL[d], open: "gesloten", close: "gesloten", slots: [] });
      }
      return NextResponse.json({
        ok: true,
        maand,
        maand_naam: MONTH_NL[maand],
        robust: robustOn ? { winsor_alpha: winsorAlpha } : undefined,
        block_minutes: blockMinutes,
        weekdays,
        staff_meta: includeStaff ? {
          jaar, groei, budget_mode: "unified_share",
          avg_item_rev_month: avgItemRevMonth,
          items_per_unit    : itemsPerQ * blockFactor,
          unit_cost_front   : costPerQ * blockFactor,
          unit_cost_kitchen : kitchenCostPerQ * blockFactor,
          startup_front_count: startupFront,
          clean_front_count  : cleanFront,
          open_lead_minutes  : preMinutes,
          close_trail_minutes: postMinutes,
          year_prev_revenue  : yearPrev,
          year_target_revenue: yearTarget,
          rev_scale          : revScale,
        } : undefined,
      });
    }

    // Open maand: bouw per weekdag
    for (let d = 1; d <= 7; d++) {
      // Basis-open/close ZONDER shift (voor de FULL-day shares)
      const baseO = opening(maand, d);
      const baseOpenHour  = Number(baseO.openHour);
      const baseCloseHour = Number(baseO.closeHour);

      // Shifted open/close (scenario) — alleen toepassen op geselecteerde weekdagen
      const shiftToday = !applyShiftSet || applyShiftSet.has(d);
      const openHour  = baseOpenHour  + (shiftToday ? (openShiftMin  / 60) : 0);
      let   closeHour = baseCloseHour + (shiftToday ? (closeShiftMin / 60) : 0);
      if (closeHour < openHour) closeHour = openHour;

      const cleanHour = cleanHourForMonth(maand);

      // Share maps:
      //  - fullShareMap   = shares voor ALLE basis-blokken (denominator)
      //  - keptShareMap   = shares voor de GEOPENDE (shifted) blokken
      const fullShareMap = new Map<string, number>();
      const keptShareMap = new Map<string, number>();

      const dayRows = byDay.get(d) || [];
      for (const r of dayRows) {
        const startH = slotStartHour(r.uur, r.kwartier);
        const s = Math.max(0, r.q_share_avg ?? 0);
        if (startH >= baseOpenHour && startH < baseCloseHour) {
          fullShareMap.set(`${r.uur}-${r.kwartier}`, s);
        }
        if (startH >= openHour && startH < closeHour) {
          keptShareMap.set(`${r.uur}-${r.kwartier}`, s);
        }
      }

      let fullSumShares = 0;
      for (const v of fullShareMap.values()) fullSumShares += v;

      const slots: any[] = [];

      // A) pre-open blokken
      if (preMinutes > 0) {
        const preStart = openHour - preMinutes / 60;
        for (let start = preStart; start < openHour - 1e-9; start += blockMinutes / 60) {
          slots.push({
            from_to: labelFor(start, blockMinutes),
            uur: Math.floor(start),
            block_minutes: blockMinutes,
            slot_type: "preopen",
            omzet_avg: 0,
            omzet_avg_robust: 0,
          });
        }
      }

      // B) sales-blokken (share-based tov fullSumShares — NIET her-normaliseren)
      const salesIdx: number[] = [];
      const dayAvg = (byDay.get(d) || [])[0]?.day_avg || 0;

      if (blockMinutes === 15) {
        for (let h = Math.floor(openHour); h < Math.ceil(closeHour - 1e-9); h++) {
          for (let q = 1; q <= 4; q++) {
            const startH = slotStartHour(h, q);
            if (startH < openHour || startH >= closeHour) continue;

            const share = keptShareMap.get(`${h}-${q}`) ?? 0;
            const base  = fullSumShares > 0 ? dayAvg * (share / fullSumShares) : 0;

            slots.push({
              from_to: labelFor(startH, 15),
              uur: h,
              kwartier: q,
              block_minutes: 15,
              slot_type: "sales",
              __share: share,
              omzet_avg: Number(base.toFixed(2)),
              omzet_avg_robust: Number(base.toFixed(2)),
            });
            salesIdx.push(slots.length - 1);
          }
        }
      } else {
        for (let h = Math.floor(openHour); h < Math.ceil(closeHour - 1e-9); h++) {
          const s1 = slotStartHour(h, 1);
          if (s1 >= openHour && s1 < closeHour) {
            const share12 = (keptShareMap.get(`${h}-1`) ?? 0) + (keptShareMap.get(`${h}-2`) ?? 0);
            const base = fullSumShares > 0 ? dayAvg * (share12 / fullSumShares) : 0;
            slots.push({
              from_to: labelFor(h, 30),
              uur: h,
              block: 1,
              block_minutes: 30,
              slot_type: "sales",
              __share: share12,
              omzet_avg: Number(base.toFixed(2)),
              omzet_avg_robust: Number(base.toFixed(2)),
            });
            salesIdx.push(slots.length - 1);
          }
          const s2 = slotStartHour(h, 3);
          if (s2 >= openHour && s2 < closeHour) {
            const share34 = (keptShareMap.get(`${h}-3`) ?? 0) + (keptShareMap.get(`${h}-4`) ?? 0);
            const base = fullSumShares > 0 ? dayAvg * (share34 / fullSumShares) : 0;
            slots.push({
              from_to: labelFor(h + 0.5, 30),
              uur: h,
              block: 2,
              block_minutes: 30,
              slot_type: "sales",
              __share: share34,
              omzet_avg: Number(base.toFixed(2)),
              omzet_avg_robust: Number(base.toFixed(2)),
            });
            salesIdx.push(slots.length - 1);
          }
        }
      }

      // C) clean-blokken
      if (postMinutes > 0) {
        const wantedEnd = closeHour + postMinutes / 60;
        const end       = Math.min(cleanHour, wantedEnd);
        for (let start = closeHour; start < end - 1e-9; start += blockMinutes / 60) {
          slots.push({
            from_to: labelFor(start, blockMinutes),
            uur: Math.floor(start),
            block_minutes: blockMinutes,
            slot_type: "clean",
            omzet_avg: 0,
            omzet_avg_robust: 0,
          });
        }
      }

      // D) kosten per slot
      const unitFront   = costPerQ * blockFactor;
      const unitKitchen = kitchenCostPerQ * blockFactor;

      for (const s of slots) {
        const hh = Number(s.from_to.slice(0,2));
        const mm = Number(s.from_to.slice(3,5));
        const startH = hh + mm/60;
        const inDay  = startH >= kitchenDayStart && startH < 17.5;
        const inEve  = startH >= 17.5 && startH < cleanHourForMonth(maand);
        const kCost  = (inDay ? kitchenDayCount : 0) * unitKitchen + (inEve ? kitchenEveCount : 0) * unitKitchen;
        s.kitchen_cost_this_slot = Number(kCost.toFixed(2));
        s.unit_cost_front        = unitFront;
      }

      // E) planning (N/Cap/Bud/Plan) met geschaalde omzet
      if (includeStaff) {
        const normPerUnit = normRevQ * blockFactor;

        for (const i of salesIdx) {
          const base  = Number(slots[i].omzet_avg); // onge-schaald
          const value = base * revScale;            // met groei

          const staff_norm     = normPerUnit   > 0 ? Math.ceil(value / normPerUnit)   : 0;
          const staff_capacity = capEURPerUnit > 0 ? Math.ceil(value / capEURPerUnit) : 0;

          const front23 = Math.max(0, 0.23 * value - Number(slots[i].kitchen_cost_this_slot || 0));
          const bud     = slots[i].unit_cost_front > 0 ? Math.floor(front23 / slots[i].unit_cost_front) : 0;

          const need    = Math.max(staff_norm, staff_capacity);
          const planRaw = Math.min(bud, need);
          const staff_plan = Math.max(1, planRaw);

          const over_budget   = staff_plan > bud;
          const budget_gap_eur = over_budget ? Number((staff_plan * slots[i].unit_cost_front - bud * slots[i].unit_cost_front).toFixed(2)) : 0;

          slots[i].staff_norm       = staff_norm;
          slots[i].staff_capacity   = staff_capacity;
          slots[i].staff_budget_cap = bud;
          slots[i].staff_plan       = staff_plan;
          slots[i].over_budget      = over_budget;
          slots[i].budget_gap_eur   = budget_gap_eur;
        }

        // NS-blokken: geforceerd Plan (front), Bud=0
        for (const s of slots) if (s.slot_type !== "sales") {
          const forcePlan = s.slot_type === "preopen" ? startupFront : cleanFront;
          s.staff_budget_cap = 0;
          s.staff_plan       = Math.max(1, forcePlan);
          s.over_budget      = s.staff_plan > 0;
          s.budget_gap_eur   = Number((s.staff_plan * s.unit_cost_front).toFixed(2));
        }
      }

      weekdays.push({
        isodow: d,
        naam  : WD_NL[d],
        open  : `${PAD(Math.floor(openHour))}:${PAD(Math.round((openHour%1)*60))}`,
        close : `${PAD(Math.floor(closeHour))}:${PAD(Math.round((closeHour%1)*60))}`,
        slots,
      });
    }

    // staff_meta voor UI
    const staffMeta = includeStaff ? {
      jaar, groei, budget_mode: "unified_share",
      avg_item_rev_month: avgItemRevMonth,
      items_per_unit    : itemsPerQ * blockFactor,
      unit_cost_front   : costPerQ * blockFactor,
      unit_cost_kitchen : kitchenCostPerQ * blockFactor,
      startup_front_count: startupFront,
      clean_front_count  : cleanFront,
      open_lead_minutes  : preMinutes,
      close_trail_minutes: postMinutes,
      year_prev_revenue  : yearPrev,
      year_target_revenue: yearTarget,
      rev_scale          : revScale,
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
