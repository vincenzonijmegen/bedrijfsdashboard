// src/app/api/rapportage/profielen/overzicht/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ProfRow = {
  isodow: number;
  uur: number;
  kwartier: number;
  omzet_avg: number;
  q_share_avg: number | null;
  day_avg: number | null;
};

type MonthExpRow = { maand: number; month_exp: number };

const WD_NL = ["", "maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag","zondag"];
const MONTH_NL = ["", "januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];

const PAD = (n: number) => String(n).padStart(2, "0");
const labelFor = (uur: number, kwartier: number) => {
  const startMin = (kwartier - 1) * 15;
  const endMin = startMin + 15;
  const h2 = uur + Math.floor(endMin / 60);
  const m2 = endMin % 60;
  return `${PAD(uur)}:${PAD(startMin)} - ${PAD(h2)}:${PAD(m2)}`;
};

function opening(maand: number, isodow: number) {
  // Verkooptijden (geen opstart/schoonmaak in deze tabel)
  if (maand === 3) return { openHour: isodow === 7 ? 13 : 12, closeHour: 20, cleanHour: 21 };
  return { openHour: isodow === 7 ? 13 : 12, closeHour: 22, cleanHour: 23 };
}

function quartersBetween(startHour: number, endHour: number) {
  const q = Math.round((endHour * 60 - startHour * 60) / 15);
  return Math.max(0, q);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const maand = Number(searchParams.get("maand") || "0");
    if (!Number.isInteger(maand) || maand < 1 || maand > 12) {
      return NextResponse.json({ ok: false, error: "Geef ?maand=1..12 mee." }, { status: 400 });
    }

    // Toggles en parameters
    const includeStaff = searchParams.get("show_staff") === "1";
    const robustOn     = searchParams.get("robust") === "1";
    const winsorAlpha  = Number(searchParams.get("winsor_alpha") || "0.10"); // 10% winsor default

    const jaar         = Number(searchParams.get("jaar") || new Date().getFullYear());
    const groei        = Number(searchParams.get("groei") || "1.03");

    // Doorzet & kosten
    const normRevQ     = Number(searchParams.get("norm")        || "100");    // € omzet / med / kwartier
    const costPerQ     = Number(searchParams.get("cost_per_q")  || "6.25");   // €25/u all-in front
    const itemsPerQ    = Number(searchParams.get("items_per_q") || "10");     // 10 items / med / kwartier

    // Keuken-baseline
    const kitchenDayStartStr = (searchParams.get("kitchen_day_start") || "10:00").trim();
    const [kdsH, kdsM]       = kitchenDayStartStr.split(":").map(Number);
    const kitchenDayStart    = (Number.isFinite(kdsH) ? kdsH : 10) + ((Number.isFinite(kdsM) ? kdsM : 0) / 60);
    const kitchenDayCount    = Number(searchParams.get("kitchen_day_count") || "1");
    const kitchenEveCount    = Number(searchParams.get("kitchen_eve_count") || "1");
    const kitchenCostPerQ    = Number(searchParams.get("kitchen_cost_per_q") || "7.50"); // €30/u

    // Bezettingscurve (maandbudget % variabel, jaar = 23%)
    const minOcc   = Number(searchParams.get("min_occ")         || "0.40");
    const maxOcc   = Number(searchParams.get("max_occ")         || "0.80");
    const pctAtMin = Number(searchParams.get("pct_at_min_occ")  || "0.30"); // 30% bij laagseizoen
    const pctAtMax = Number(searchParams.get("pct_at_max_occ")  || "0.18"); // 18% bij hoogseizoen

    // DB
    const mod = await import("@/lib/dbRapportage");
    const db  = mod.dbRapportage;

    // 1) Profiel-rijen (raw gemiddelden per kwartier, + q_share_avg, + daggemiddelde)
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

    // Groepeer profiel per weekdag
    const byDay = new Map<number, ProfRow[]>();
    rows.forEach(r => {
      if (!byDay.has(r.isodow)) byDay.set(r.isodow, []);
      byDay.get(r.isodow)!.push(r);
    });

    // 2) (Optioneel) Robuuste uur-gemiddelden (winsorized per isodow × uur)
    //    We nemen ALLE jaren mee, met maand = gekozen maand.
    const robustHourMap: Record<number, Record<number, number>> = {};
    if (robustOn) {
      const sqlWinsorHours = `
        WITH base AS (
          SELECT
            DATE(o.datum)                           AS d,
            EXTRACT(MONTH  FROM o.datum)::int       AS m,
            EXTRACT(ISODOW FROM o.datum)::int       AS isodow,
            EXTRACT(HOUR   FROM o.datum)::int       AS uur,
            SUM(o.omzet)::numeric                   AS omzet_uur
          FROM rapportage.omzet_kwartier o
          WHERE EXTRACT(MONTH FROM o.datum)::int = $1
          GROUP BY 1,2,3,4
        ),
        b AS (
          SELECT isodow, uur, omzet_uur
          FROM   base
          WHERE  m = $1
        ),
        bounds AS (
          SELECT
            isodow, uur,
            PERCENTILE_CONT($2)   WITHIN GROUP (ORDER BY omzet_uur) AS p_low,
            PERCENTILE_CONT(1-$2) WITHIN GROUP (ORDER BY omzet_uur) AS p_high
          FROM b
          GROUP BY isodow, uur
        ),
        winsored AS (
          SELECT
            b.isodow, b.uur,
            GREATEST(LEAST(b.omzet_uur, bo.p_high), bo.p_low) AS w
          FROM b
          JOIN bounds bo USING (isodow, uur)
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

    // Zonder personeel (alleen omzet) alvast voorbereiden
    const weekdaysBase: Array<{
      isodow: number; naam: string; open: string; close: string;
      slots: Array<{ from_to: string; uur: number; kwartier: number; omzet_avg: number; omzet_avg_robust?: number }>;
    }> = [];

    for (let d = 1; d <= 7; d++) {
      const { openHour, closeHour } = opening(maand, d);
      const list = (byDay.get(d) || []).filter(r => r.uur >= openHour && r.uur < closeHour);

      // Voor robuuste terugverdeling: som per uur van de profiel-kwartieren
      const hourSumRaw: Record<number, number> = {};
      for (const r of list) {
        hourSumRaw[r.uur] = (hourSumRaw[r.uur] || 0) + (r.omzet_avg || 0);
      }

      const slots: Array<{ from_to: string; uur: number; kwartier: number; omzet_avg: number; omzet_avg_robust?: number }> = [];
      for (let h = openHour; h < closeHour; h++) {
        const hourTotalRaw = hourSumRaw[h] || 0;
        const winsorHour   = robustOn ? (robustHourMap[d]?.[h] ?? 0) : 0;

        for (let q = 1; q <= 4; q++) {
          const r = list.find(x => x.uur === h && x.kwartier === q);
          const raw = r?.omzet_avg ?? 0;

          let robQ: number | undefined = undefined;
          if (robustOn) {
            if (hourTotalRaw > 0) {
              const weight = raw / hourTotalRaw; // verdeling volgen
              robQ = winsorHour * weight;
            } else {
              // fallback: gelijke verdeling
              robQ = winsorHour / 4;
            }
          }

          slots.push({
            from_to: labelFor(h, q),
            uur: h,
            kwartier: q,
            omzet_avg: raw,
            ...(robustOn ? { omzet_avg_robust: Number((robQ || 0).toFixed(2)) } : {}),
          });
        }
      }

      weekdaysBase.push({
        isodow: d,
        naam: WD_NL[d],
        open: `${PAD(openHour)}:00`,
        close: `${PAD(closeHour)}:00`,
        slots,
      });
    }

    // Als geen personeel gevraagd is, zijn we klaar
    if (!includeStaff) {
      return NextResponse.json({
        ok: true,
        maand,
        maand_naam: MONTH_NL[maand],
        weekdays: weekdaysBase,
        robust: robustOn ? { winsor_alpha: winsorAlpha } : undefined,
      });
    }

    // === Personeel: 23% jaarbudget → maandbudget (variabel) → keuken-afslag → frontverdelen ===

    // 3) Jaaromzet en jaarbudget
    const prev = await db.query(
      `SELECT COALESCE(SUM(aantal * eenheidsprijs),0) AS y FROM rapportage.omzet WHERE EXTRACT(YEAR FROM datum)::int = $1`,
      [jaar - 1]
    );
    const yearPrev   = Number(prev.rows[0]?.y || 0);
    const yearTarget = Math.round(yearPrev * (isFinite(groei) && groei > 0 ? groei : 1));
    const yearBudget = yearTarget * 0.23;

    // 4) Verwachte maandomzet (op basis van profielen × #dagen)
    const sqlMonthExp = `
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
      ),
      month_exp AS (
        SELECT dc.maand,
               SUM( COALESCE(da.day_avg,0) * dc.n_days )::numeric AS month_exp
        FROM day_counts dc
        LEFT JOIN day_avg da ON da.maand = dc.maand AND da.isodow = dc.isodow
        GROUP BY dc.maand
      )
      SELECT maand, month_exp FROM month_exp ORDER BY maand;
    `;
    const mexp = await db.query(sqlMonthExp, [jaar]);
    const monthExp: MonthExpRow[] = mexp.rows.map((r: any) => ({ maand: Number(r.maand), month_exp: Number(r.month_exp || 0) }));
    const yearExp = monthExp.reduce((a, b) => a + b.month_exp, 0);
    const monthExpThis = monthExp.find(x => x.maand === maand)?.month_exp || 0;

    const maxMonthExp = Math.max(...monthExp.map(m => m.month_exp));
    const occByMonth: Record<number, number> = {};
    const allowedPctRaw: Record<number, number> = {};
    for (const m of monthExp) {
      const occ = maxMonthExp > 0 ? (m.month_exp / maxMonthExp) : 0;
      occByMonth[m.maand] = occ;
      let pct: number;
      if (occ <= minOcc) pct = pctAtMin;
      else if (occ >= maxOcc) pct = pctAtMax;
      else {
        const t = (occ - minOcc) / (maxOcc - minOcc);
        pct = pctAtMin + (pctAtMax - pctAtMin) * t;
      }
      allowedPctRaw[m.maand] = pct;
    }

    // Normaliseer maandbudgetten naar jaarbudget
    let sumRaw = 0;
    const rawBud: Record<number, number> = {};
    for (const m of monthExp) {
      const raw = (allowedPctRaw[m.maand] || 0) * (m.month_exp || 0);
      rawBud[m.maand] = raw; sumRaw += raw;
    }
    const scale = sumRaw > 0 ? (yearBudget / sumRaw) : 0;
    const monthBudgetMap: Record<number, number> = {};
    for (const m of monthExp) monthBudgetMap[m.maand] = rawBud[m.maand] * scale;
    const monthBudget = monthBudgetMap[maand] || 0;

    // Gem. omzet per item voor deze maand (alle jaren)
    const avgItemRs = await db.query(
      `SELECT COALESCE(SUM(aantal),0) AS items, COALESCE(SUM(aantal*eenheidsprijs),0) AS omzet
       FROM rapportage.omzet WHERE EXTRACT(MONTH FROM datum)::int = $1`, [maand]
    );
    const totItems = Number(avgItemRs.rows[0]?.items || 0);
    const totOmzet = Number(avgItemRs.rows[0]?.omzet || 0);
    const avgItemRevMonth = totItems > 0 ? (totOmzet / totItems) : 0;
    const capRevPerStaffQ = itemsPerQ > 0 ? (itemsPerQ * avgItemRevMonth) : 0;

    // Bouw uiteindelijke output per weekdag, met keuken-baseline en staff op robuuste of raw omzet
    const weekdays: any[] = [];
    for (const wd of weekdaysBase) {
      const d = wd.isodow;
      const { cleanHour } = opening(maand, d);

      // Dagbudget bruto (op daggemiddelde)
      const list = (byDay.get(d) || []);
      const dayAvg = list.length ? (list[0].day_avg ?? 0) : 0;
      const dayBudgetGross = (monthBudget > 0 && monthExpThis > 0) ? monthBudget * (dayAvg / monthExpThis) : 0;

      // Keuken baseline per dag
      const splitHour = 17.5;
      const qKDay = quartersBetween(kitchenDayStart, Math.min(splitHour, cleanHour));
      const qKEve = quartersBetween(splitHour, cleanHour);
      const kitchenCostDay   = kitchenDayCount * qKDay * kitchenCostPerQ;
      const kitchenCostEve   = kitchenEveCount * qKEve * kitchenCostPerQ;
      const kitchenCostTotal = kitchenCostDay + kitchenCostEve;

      const dayBudgetFront = Math.max(0, dayBudgetGross - kitchenCostTotal);

      // Voor robuuste terugverdeling hebben we per uur de winstoor-uur (al in robustHourMap) en de raw uur-som (voor weights is per slot al raw)
      // Verdeel het frontbudget naar kwartieren met q_share (uit profiel), zoals eerder
      const sumQByHour: Record<number, number> = {};
      for (const r of list) {
        sumQByHour[r.uur] = (sumQByHour[r.uur] || 0) + (r.q_share_avg ?? 0);
      }

      // Eerst: kwartier-budgetten via q_share
      const slotBudget: Record<string, number> = {};
      for (const r of list) {
        const sumQ = sumQByHour[r.uur] || 0;
        const share = sumQ > 0 && r.q_share_avg != null ? (r.q_share_avg / sumQ) : (1 / Math.max(1, list.length));
        const qLabel = `${r.uur}-${r.kwartier}`;
        slotBudget[qLabel] = dayBudgetFront * share;
      }

      // Slots vullen met staff (gebruik robuust of raw omzet)
      const outSlots = wd.slots.map((s: any) => {
        const omzetBase = robustOn && s.omzet_avg_robust != null ? Number(s.omzet_avg_robust) : Number(s.omzet_avg);
        const quarterBudgetFront = Number((slotBudget[`${s.uur}-${s.kwartier}`] || 0).toFixed(2));

        const staff_norm      = normRevQ > 0       ? Math.ceil(omzetBase / normRevQ)        : 0;
        const staff_capacity  = capRevPerStaffQ > 0? Math.ceil(omzetBase / capRevPerStaffQ) : 0;
        const staff_budget_cap= costPerQ > 0       ? Math.floor(quarterBudgetFront / costPerQ) : 0;

        const need = Math.max(staff_norm, staff_capacity);
        const minCoverage = 1;
        const planRaw = Math.min(staff_budget_cap, need);
        const staff_plan = Math.max(minCoverage, planRaw);
        const over_budget = staff_plan > staff_budget_cap;
        const budget_gap_eur = over_budget ? Number((staff_plan * costPerQ - quarterBudgetFront).toFixed(2)) : 0;

        return {
          ...s,
          budget_eur: quarterBudgetFront,
          staff_norm, staff_capacity, staff_budget_cap,
          staff_plan, over_budget, budget_gap_eur,
        };
      });

      weekdays.push({
        ...wd,
        slots: outSlots
      });
    }

    return NextResponse.json({
      ok: true,
      maand,
      maand_naam: MONTH_NL[maand],
      robust: robustOn ? { winsor_alpha: winsorAlpha } : undefined,
      weekdays,
      staff_meta: {
        jaar, groei,
        yearPrev, yearTarget, yearBudget,
        monthBudget,
        occ_this: ((): number => {
          const maxMonthExp = Math.max(...monthExp.map(m => m.month_exp));
          return maxMonthExp > 0 ? ((monthExpThis || 0) / maxMonthExp) : 0;
        })(),
        avg_item_rev_month: Number((itemsPerQ > 0 ? (totOmzet / Math.max(1, totItems)) : 0).toFixed(4)),
        items_per_q: itemsPerQ,
        cap_rev_per_staff_q: Number(capRevPerStaffQ.toFixed(2)),
        kitchen: {
          day_start: kitchenDayStartStr,
          day_count: kitchenDayCount,
          eve_count: kitchenEveCount,
          cost_per_q: kitchenCostPerQ
        }
      }
    });

  } catch (err: any) {
    console.error("profiel-overzicht error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
