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

const WD_NL = ["", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];
const MONTH_NL = ["", "januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];

const PAD = (n: number) => String(n).padStart(2, "0");
const labelFor = (startHour: number, minutes: number) => {
  const h1 = Math.floor(startHour);
  const m1 = Math.round((startHour - h1) * 60);
  const mStart = m1;
  const mEnd = m1 + minutes;
  const h2 = h1 + Math.floor(mEnd / 60);
  const mm2 = mEnd % 60;
  return `${PAD(h1)}:${PAD(mStart)} - ${PAD(h2)}:${PAD(mm2)}`;
};

function opening(maand: number, isodow: number) {
  // Verkooptijden (geen opstart/schoonmaak in de slots)
  if (maand === 3) return { openHour: isodow === 7 ? 13 : 12, closeHour: 20, cleanHour: 21 };
  return { openHour: isodow === 7 ? 13 : 12, closeHour: 22, cleanHour: 23 };
}
function cleanHourForMonth(maand: number) {
  return maand === 3 ? 21 : 23;
}
function quartersBetween(startHour: number, endHour: number) {
  return Math.max(0, Math.round((endHour - startHour) * 4));
}
function slotStartHour(uur: number, kwartier: number) {
  // kwartier 1..4 => offset 0, 0.25, 0.5, 0.75 uur
  return uur + (kwartier - 1) * 0.25;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Vereist
    const maand = Number(searchParams.get("maand") || "0");
    if (!Number.isInteger(maand) || maand < 1 || maand > 12) {
      return NextResponse.json({ ok: false, error: "Geef ?maand=1..12 mee." }, { status: 400 });
    }

    // Blokgrootte: 15 of 30 minuten
    const blockMinutes = Number(searchParams.get("block_minutes") || "15");
    const blockFactor = blockMinutes === 30 ? 2 : 1; // t.o.v. 15 minuten
    const validBlock = blockMinutes === 15 || blockMinutes === 30;
    if (!validBlock) {
      return NextResponse.json({ ok: false, error: "block_minutes moet 15 of 30 zijn." }, { status: 400 });
    }

    // Opties
    const robustOn     = searchParams.get("robust") === "1";
    const winsorAlpha  = Number(searchParams.get("winsor_alpha") || "0.10"); // 10%

    const includeStaff = searchParams.get("show_staff") === "1";
    const jaar         = Number(searchParams.get("jaar") || new Date().getFullYear());
    const groei        = Number(searchParams.get("groei") || "1.03"); // voor meta; niet meer nodig voor Bud

    // Doorzet & kosten (per 15 minuten eenheid)
    const normRevQ     = Number(searchParams.get("norm")        || "100");    // €/med/kw
    const costPerQ     = Number(searchParams.get("cost_per_q")  || "6.25");   // €25/u ≈ 6.25/kw
    const itemsPerQ    = Number(searchParams.get("items_per_q") || "10");     // items/med/kw

    // Keuken-baseline
    const kitchenDayStartStr = (searchParams.get("kitchen_day_start") || "10:00").trim();
    const [kdsH, kdsM]       = kitchenDayStartStr.split(":").map(Number);
    const kitchenDayStart    = (Number.isFinite(kdsH) ? kdsH : 10) + ((Number.isFinite(kdsM) ? kdsM : 0) / 60);
    const kitchenDayCount    = Number(searchParams.get("kitchen_day_count") || "1");
    const kitchenEveCount    = Number(searchParams.get("kitchen_eve_count") || "1");
    const kitchenCostPerQ    = Number(searchParams.get("kitchen_cost_per_q") || "7.50"); // €30/u

    const mod = await import("@/lib/dbRapportage");
    const db  = mod.dbRapportage;

    // 1) Profiel-rijen (raw kwartiergemiddelden en q_share_avg, plus daggemiddelde)
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

    // Groepeer per weekdag
    const byDay = new Map<number, ProfRow[]>();
    rows.forEach((r) => {
      if (!byDay.has(r.isodow)) byDay.set(r.isodow, []);
      byDay.get(r.isodow)!.push(r);
    });

    // 2) Robuuste uur-gemiddelden (winsorized) per isodow×uur (alle jaren voor deze maand)
    const robustHourMap: Record<number, Record<number, number>> = {};
    if (robustOn) {
      const sqlWinsorHours = `
        WITH base AS (
          SELECT
            o.datum::date                         AS d,
            EXTRACT(MONTH  FROM o.datum)::int     AS m,
            EXTRACT(ISODOW FROM o.datum)::int     AS isodow,
            o.uur::int                            AS uur,
            SUM(o.omzet)::numeric                 AS omzet_uur
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
            PERCENTILE_CONT($2)   WITHIN GROUP (ORDER BY omzet_uur)   AS p_low,
            PERCENTILE_CONT(1-$2) WITHIN GROUP (ORDER BY omzet_uur)   AS p_high
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

    // 3) Gem. omzet per item (voor capaciteit) – per maand over alle jaren
    const avgItemRs = await db.query(
      `SELECT COALESCE(SUM(aantal),0) AS items, COALESCE(SUM(aantal*eenheidsprijs),0) AS omzet
       FROM rapportage.omzet WHERE EXTRACT(MONTH FROM datum)::int = $1`,
      [maand]
    );
    const totItems = Number(avgItemRs.rows[0]?.items || 0);
    const totOmzet = Number(avgItemRs.rows[0]?.omzet || 0);
    const avgItemRevMonth = totItems > 0 ? (totOmzet / totItems) : 0;

    // 4) Bouw weekschema + slots
    const weekdays: Array<{
      isodow: number;
      naam: string;
      open: string;
      close: string;
      slots: Array<{
        from_to: string;
        uur: number;
        // bij 15m: kwartier (1..4), bij 30m: block (1..2)
        kwartier?: number;
        block?: number;
        block_minutes: number;
        omzet_avg: number;
        omzet_avg_robust?: number;
        // personeel
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
      const dayRows = (byDay.get(d) || []).filter((r) => r.uur >= openHour && r.uur < closeHour);

      // som per uur van raw kwartieren (voor verdelingsgewichten & blokken)
      const hourSumRaw: Record<number, number> = {};
      const hourQRaw: Record<number, number[]> = {};
      for (const r of dayRows) {
        hourSumRaw[r.uur] = (hourSumRaw[r.uur] || 0) + (r.omzet_avg || 0);
        (hourQRaw[r.uur] ||= [0, 0, 0, 0])[r.kwartier - 1] = r.omzet_avg || 0;
      }

      const slots: any[] = [];

      for (let h = openHour; h < closeHour; h++) {
        const hourTotalRaw = hourSumRaw[h] || 0;
        const winsorHour   = robustOn ? (robustHourMap[d]?.[h] ?? 0) : 0;
        const qs = hourQRaw[h] || [0, 0, 0, 0];

        if (blockMinutes === 15) {
          // vier kwartieren
          for (let q = 1; q <= 4; q++) {
            const raw = qs[q - 1] || 0;
            const rob = robustOn
              ? (hourTotalRaw > 0 ? (winsorHour * (raw / hourTotalRaw)) : winsorHour / 4)
              : undefined;

            slots.push({
              from_to: labelFor(slotStartHour(h, q), 15),
              uur: h,
              kwartier: q,
              block_minutes: 15,
              omzet_avg: raw,
              ...(robustOn ? { omzet_avg_robust: Number((rob || 0).toFixed(2)) } : {}),
            });
          }
        } else {
          // twee halfuren: (q1+q2) en (q3+q4)
          const rawA = (qs[0] || 0) + (qs[1] || 0);
          const rawB = (qs[2] || 0) + (qs[3] || 0);
          const weightA = hourTotalRaw > 0 ? rawA / hourTotalRaw : 0.5;
          const weightB = hourTotalRaw > 0 ? rawB / hourTotalRaw : 0.5;
          const robA = robustOn ? winsorHour * weightA : undefined;
          const robB = robustOn ? winsorHour * weightB : undefined;

          slots.push({
            from_to: labelFor(h + 0, 30), // :00–:30
            uur: h,
            block: 1,
            block_minutes: 30,
            omzet_avg: rawA,
            ...(robustOn ? { omzet_avg_robust: Number((robA || 0).toFixed(2)) } : {}),
          });
          slots.push({
            from_to: labelFor(h + 0.5, 30), // :30–:00
            uur: h,
            block: 2,
            block_minutes: 30,
            omzet_avg: rawB,
            ...(robustOn ? { omzet_avg_robust: Number((robB || 0).toFixed(2)) } : {}),
          });
        }
      }

      // Personeelsberekening per slot (Bud = 23% * omzet_slot − keuken_slot)
      if (includeStaff) {
        const cleanH = cleanHourForMonth(maand);
        const normRevUnit = normRevQ * blockFactor;
        const costPerUnit = costPerQ * blockFactor;
        const capRevPerStaffUnit = (itemsPerQ * blockFactor) * avgItemRevMonth;
        const kitchenCostPerUnit = kitchenCostPerQ * blockFactor;

        for (const s of slots) {
          const value = robustOn && s.omzet_avg_robust != null ? Number(s.omzet_avg_robust) : Number(s.omzet_avg);
          const startH = (() => {
            if (blockMinutes === 15) {
              const q = s.kwartier as number; // 1..4
              return slotStartHour(s.uur, q);
            } else {
              // block 1 start op :00, block 2 start op :30
              return s.block === 1 ? s.uur : s.uur + 0.5;
            }
          })();

          // 23% van omzet in dit slot
          const grossBudget = 0.23 * value;

          // Keuken voor dit slot
          const inDay = startH >= kitchenDayStart && startH < 17.5;
          const inEve = startH >= 17.5 && startH < cleanH;
          const kCostThis = (inDay ? kitchenDayCount : 0) * kitchenCostPerUnit
                          + (inEve ? kitchenEveCount : 0) * kitchenCostPerUnit;

          const quarterBudgetFront = Math.max(0, grossBudget - kCostThis);

          const staff_norm     = normRevUnit > 0 ? Math.ceil(value / normRevUnit) : 0;
          const staff_capacity = capRevPerStaffUnit > 0 ? Math.ceil(value / capRevPerStaffUnit) : 0;
          const staff_budget_cap = costPerUnit > 0 ? Math.floor(quarterBudgetFront / costPerUnit) : 0;

          const need = Math.max(staff_norm, staff_capacity);
          const minCoverage = 1;
          const planRaw = Math.min(staff_budget_cap, need);
          const staff_plan = Math.max(minCoverage, planRaw);

          const over_budget = staff_plan > staff_budget_cap;
          const budget_gap_eur = over_budget ? Number((staff_plan * costPerUnit - quarterBudgetFront).toFixed(2)) : 0;

          s.unit_cost_front = costPerUnit;
          s.kitchen_cost_this_slot = Number(kCostThis.toFixed(2));
          s.staff_norm = staff_norm;
          s.staff_capacity = staff_capacity;
          s.staff_budget_cap = staff_budget_cap;
          s.staff_plan = staff_plan;
          s.over_budget = over_budget;
          s.budget_gap_eur = budget_gap_eur;
        }
      }

      weekdays.push({
        isodow: d,
        naam: WD_NL[d],
        open: `${PAD(openHour)}:00`,
        close: `${PAD(closeHour)}:00`,
        slots,
      });
    }

    return NextResponse.json({
      ok: true,
      maand,
      maand_naam: MONTH_NL[maand],
      robust: robustOn ? { winsor_alpha: winsorAlpha } : undefined,
      block_minutes: blockMinutes,
      weekdays,
      // meta (capaciteit e.d.)
      staff_meta: includeStaff
        ? {
            jaar,
            groei,
            avg_item_rev_month: Number(avgItemRevMonth.toFixed(4)),
            items_per_unit: itemsPerQ * blockFactor,
            unit_cost_front: costPerQ * blockFactor,
            unit_cost_kitchen: kitchenCostPerQ * blockFactor,
          }
        : undefined,
    });
  } catch (err: any) {
    console.error("profiel-overzicht error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
