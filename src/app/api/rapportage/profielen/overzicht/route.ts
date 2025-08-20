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
  // Verkooptijden (zoals jouw overzicht), zonder opstart/schoonmaak
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

    // Toggle personeel & parameters (defaults verhoogd)
    const includeStaff = searchParams.get("show_staff") === "1";
    const jaar = Number(searchParams.get("jaar") || new Date().getFullYear());
    const groei = Number(searchParams.get("groei") || "1.03");

    const normRevQ   = Number(searchParams.get("norm")        || "100");  // € omzet / med / kwartier
    const costPerQ   = Number(searchParams.get("cost_per_q")  || "6.25"); // € 25/u all-in
    const itemsPerQ  = Number(searchParams.get("items_per_q") || "10");   // 10 items / med / kwartier

    // Keuken-baseline
    const kitchenDayStartStr = (searchParams.get("kitchen_day_start") || "10:00").trim();
    const [kdsH, kdsM] = kitchenDayStartStr.split(":").map(Number);
    const kitchenDayStart = (Number.isFinite(kdsH) ? kdsH : 10) + ((Number.isFinite(kdsM) ? kdsM : 0) / 60);

    const kitchenDayCount = Number(searchParams.get("kitchen_day_count") || "1"); // 1 kok overdag
    const kitchenEveCount = Number(searchParams.get("kitchen_eve_count") || "1"); // 1 kok avond
    const kitchenCostPerQ = Number(searchParams.get("kitchen_cost_per_q") || "7.50"); // €30/u all-in

    // Bezettingscurve (maandbudget % variabel)
    const minOcc   = Number(searchParams.get("min_occ")         || "0.40");
    const maxOcc   = Number(searchParams.get("max_occ")         || "0.80");
    const pctAtMin = Number(searchParams.get("pct_at_min_occ")  || "0.30");
    const pctAtMax = Number(searchParams.get("pct_at_max_occ")  || "0.18");

    const mod = await import("@/lib/dbRapportage");
    const db  = mod.dbRapportage;

    // 1) Profiel-rijen voor maand (incl. q_share_avg, day_avg)
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

    // Per weekdag groeperen
    const byDay = new Map<number, ProfRow[]>();
    rows.forEach(r => { (byDay.get(r.isodow) ?? byDay.set(r.isodow, []).get(r.isodow)!)?.push(r); });

    // Zonder personeel: rechtstreeks teruggeven
    const weekdaysBase: Array<{
      isodow: number; naam: string; open: string; close: string;
      slots: Array<{ from_to: string; uur: number; kwartier: number; omzet_avg: number }>;
    }> = [];

    for (let d = 1; d <= 7; d++) {
      const { openHour, closeHour } = opening(maand, d);
      const list = (byDay.get(d) || []).filter(r => r.uur >= openHour && r.uur < closeHour);

      const slots: Array<{ from_to: string; uur: number; kwartier: number; omzet_avg: number }> = [];
      for (let h = openHour; h < closeHour; h++) {
        for (let q = 1; q <= 4; q++) {
          const r = list.find(x => x.uur === h && x.kwartier === q);
          slots.push({ from_to: labelFor(h, q), uur: h, kwartier: q, omzet_avg: r?.omzet_avg ?? 0 });
        }
      }

      weekdaysBase.push({
        isodow: d,
        naam: WD_NL[d],
        open: `${PAD(openHour)}:00`,
        close: `${PAD(closeHour)}:00`,
        slots
      });
    }

    if (!includeStaff) {
      return NextResponse.json({ ok: true, maand, maand_naam: MONTH_NL[maand], weekdays: weekdaysBase });
    }

    // === Personeel: 23% budget → per maand variabel → keuken eraf → front verdelen ===

    // 2) Jaaromzet en jaarbudget
    const prev = await db.query(
      `SELECT COALESCE(SUM(aantal * eenheidsprijs),0) AS y FROM rapportage.omzet WHERE EXTRACT(YEAR FROM datum)::int = $1`,
      [jaar - 1]
    );
    const yearPrev   = Number(prev.rows[0]?.y || 0);
    const yearTarget = Math.round(yearPrev * (isFinite(groei) && groei > 0 ? groei : 1));
    const yearBudget = yearTarget * 0.23;

    // 3) Verwachte maandomzet (op basis van profielen × #dagen)
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
        SELECT dc.maand, SUM(COALESCE(da.day_avg,0) * dc.n_days)::numeric AS month_exp
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

    // 4) Bezettingsgraad per maand → toegestaan personeels% rauw (lineair tussen pctAtMin ↔ pctAtMax)
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

    // 5) Normaliseer maandbudgetten naar jaarbudget
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

    // 6) Gem. omzet per item voor deze maand (alle jaren)
    const avgItemRs = await db.query(
      `SELECT COALESCE(SUM(aantal),0) AS items, COALESCE(SUM(aantal*eenheidsprijs),0) AS omzet
       FROM rapportage.omzet WHERE EXTRACT(MONTH FROM datum)::int = $1`, [maand]
    );
    const totItems = Number(avgItemRs.rows[0]?.items || 0);
    const totOmzet = Number(avgItemRs.rows[0]?.omzet || 0);
    const avgItemRevMonth = totItems > 0 ? (totOmzet / totItems) : 0;
    const capRevPerStaffQ = itemsPerQ > 0 ? (itemsPerQ * avgItemRevMonth) : 0;

    // 7) Response met keuken-baseline in budget (front = dagbudget - keuken)
    const weekdays: any[] = [];
    for (let d = 1; d <= 7; d++) {
      const { openHour, closeHour, cleanHour } = opening(maand, d);
      const list = (byDay.get(d) || []).filter(r => r.uur >= openHour && r.uur < closeHour);

      // q_share normaliseren binnen de dag
      const sumQ = list.reduce((acc, r) => acc + (r.q_share_avg ?? 0), 0);
      const qNorm = (r: ProfRow | undefined) =>
        (sumQ > 0 && r?.q_share_avg != null) ? (r.q_share_avg / sumQ) : (1 / Math.max(1, list.length));

      // Dagbudget bruto (voor deze weekdag)
      const dayAvgByIso = list.length ? (list[0].day_avg ?? 0) : 0;
      const dayBudgetGross = (monthBudget > 0 && monthExpThis > 0) ? monthBudget * (dayAvgByIso / monthExpThis) : 0;

      // Keuken-baseline: dag 10:00 → 17:30, avond 17:30 → clean
      const splitHour = 17.5;
      const qKDay  = quartersBetween(kitchenDayStart, Math.min(splitHour, cleanHour));
      const qKEve  = quartersBetween(splitHour, cleanHour);
      const kitchenCostDay = kitchenDayCount * qKDay * kitchenCostPerQ;
      const kitchenCostEve = kitchenEveCount * qKEve * kitchenCostPerQ;
      const kitchenCostTotal = kitchenCostDay + kitchenCostEve;

      // Frontbudget per dag = bruto – keuken (niet < 0)
      const dayBudgetFront = Math.max(0, dayBudgetGross - kitchenCostTotal);

      const slots: any[] = [];
      for (let h = openHour; h < closeHour; h++) {
        for (let q = 1; q <= 4; q++) {
          const r = list.find(x => x.uur === h && x.kwartier === q);
          const omzet_avg = r?.omzet_avg ?? 0;
          const from_to = labelFor(h, q);

          // Verdeel het frontbudget naar kwartieren o.b.v. q_share
          const quarterBudgetFront = dayBudgetFront * qNorm(r);

          // Norm: omzet per med/kw
          const staff_norm = normRevQ > 0 ? Math.ceil(omzet_avg / normRevQ) : 0;

          // Capaciteit: items per med/kw * avg €/item
          const staff_capacity = capRevPerStaffQ > 0 ? Math.ceil(omzet_avg / capRevPerStaffQ) : 0;

          // Budget-cap: restant budget voor front / front kost/kw
          const staff_budget_cap = costPerQ > 0 ? Math.floor(quarterBudgetFront / costPerQ) : 0;

          // ... boven heb je quarterBudgetFront, staff_norm, staff_capacity, staff_budget_cap
            const need = Math.max(staff_norm, staff_capacity);

            // Minimale bezetting tijdens opening: altijd ≥ 1
            const minCoverage = 1;

            // Eerst "planRaw" (wat binnen budget past), daarna forceren we min 1
            const planRaw = Math.min(staff_budget_cap, need);
            const staff_plan = Math.max(minCoverage, planRaw);

            // Als we boven budget moeten gaan om min. coverage te halen, toon dat
            const over_budget = staff_plan > staff_budget_cap;
            const budget_gap_eur = over_budget ? Number((staff_plan * costPerQ - quarterBudgetFront).toFixed(2)) : 0;

            slots.push({
            from_to, uur: h, kwartier: q, omzet_avg,
            budget_eur: Number(quarterBudgetFront.toFixed(2)),
            staff_norm, staff_capacity, staff_budget_cap,
            staff_plan,
            over_budget,
            budget_gap_eur
            });

        }
      }

      weekdays.push({
        isodow: d,
        naam: WD_NL[d],
        open: `${PAD(openHour)}:00`,
        close: `${PAD(closeHour)}:00`,
        slots
      });
    }

    return NextResponse.json({
      ok: true,
      maand,
      maand_naam: MONTH_NL[maand],
      weekdays,
      staff_meta: {
        jaar, groei,
        yearPrev, yearTarget, yearBudget,
        monthBudget,
        occ_this: occByMonth[maand] ?? 0,
        allowed_pct_this_raw: allowedPctRaw[maand] ?? 0,
        avg_item_rev_month: Number(avgItemRevMonth.toFixed(4)),
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
