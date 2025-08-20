// src/app/api/rapportage/profielen/overzicht/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ProfRow = {
  isodow: number;
  uur: number;
  kwartier: number;
  omzet_avg: number;
  q_share_avg: number | null;
  day_avg: number | null; // dagomzet_avg voor deze maand×weekdag (constant per dag)
};
type MonthExpRow = { maand: number; month_exp: number };

const WD_NL = ["", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];
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
  if (maand === 3) return { openHour: isodow === 7 ? 13 : 12, closeHour: 20 };
  return { openHour: isodow === 7 ? 13 : 12, closeHour: 22 };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const maand = Number(searchParams.get("maand") || "0");
    if (!Number.isInteger(maand) || maand < 1 || maand > 12) {
      return NextResponse.json({ ok: false, error: "Geef ?maand=1..12 mee." }, { status: 400 });
    }

    // Personeels-toggle en parameters
    const includeStaff = searchParams.get("show_staff") === "1";
    const jaar = Number(searchParams.get("jaar") || new Date().getFullYear());
    const groei = Number(searchParams.get("groei") || "1.03");
    const normRevQ = Number(searchParams.get("norm") || "0");        // € omzet / medewerker / kwartier
    const costPerQ = Number(searchParams.get("cost_per_q") || "0");   // loonkosten / medewerker / kwartier
    const itemsPerQ = Number(searchParams.get("items_per_q") || "10"); // items / medewerker / kwartier
    const minOcc = Number(searchParams.get("min_occ") || "0.40");     // b.v. 0.40
    const maxOcc = Number(searchParams.get("max_occ") || "0.80");     // b.v. 0.80
    const pctAtMin = Number(searchParams.get("pct_at_min_occ") || "0.30"); // 30% bij laagseizoen
    const pctAtMax = Number(searchParams.get("pct_at_max_occ") || "0.18"); // 18% bij hoogseizoen

    // DB
    const mod = await import("@/lib/dbRapportage");
    const db = mod.dbRapportage;

    // 1) Profielrijen ophalen (incl. q_share_avg en daggemiddelde per (maand,weekdag))
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

    // Groepering per weekdag
    const byDay = new Map<number, ProfRow[]>();
    rows.forEach((r) => {
      if (!byDay.has(r.isodow)) byDay.set(r.isodow, []);
      byDay.get(r.isodow)!.push(r);
    });

    // Voor UI zonder personeel: per dag de slots binnen openingstijd
    const weekdaysBase: Array<{
      isodow: number; naam: string; open: string; close: string;
      slots: Array<{ from_to: string; uur: number; kwartier: number; omzet_avg: number }>;
    }> = [];

    for (let d = 1; d <= 7; d++) {
      const { openHour, closeHour } = opening(maand, d);
      const list = (byDay.get(d) || []).filter(r => r.uur >= openHour && r.uur < closeHour);

      const slots = [];
      for (let h = openHour; h < closeHour; h++) {
        for (let q = 1; q <= 4; q++) {
          const r = list.find(x => x.uur === h && x.kwartier === q);
          slots.push({
            from_to: labelFor(h, q),
            uur: h,
            kwartier: q,
            omzet_avg: r?.omzet_avg ?? 0
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

    if (!includeStaff) {
      return NextResponse.json({
        ok: true,
        maand,
        maand_naam: MONTH_NL[maand],
        weekdays: weekdaysBase,
      });
    }

    // === Personeel: berekeningen ===

    // 2) Jaaromzet vorig jaar + forecast & jaarbudget
    const prevRs = await db.query(
      `SELECT COALESCE(SUM(aantal * eenheidsprijs),0) AS y FROM rapportage.omzet WHERE EXTRACT(YEAR FROM datum)::int = $1`,
      [jaar - 1]
    );
    const yearPrev = Number(prevRs.rows[0]?.y || 0);
    const yearTarget = Math.round(yearPrev * (isFinite(groei) && groei > 0 ? groei : 1.0));
    const yearBudget = yearTarget * 0.23;

    // 3) Verwachte maandomzet voor het hele jaar op basis van profielen
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

    // 4) Bezettingsgraad per maand en allowed pct per maand (lineaire interpolatie)
    const maxMonthExp = Math.max(...monthExp.map(m => m.month_exp));
    const occByMonth: Record<number, number> = {};
    const allowedPctRaw: Record<number, number> = {};
    for (const m of monthExp) {
      const occ = maxMonthExp > 0 ? (m.month_exp / maxMonthExp) : 0; // 0..1
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

    // 5) Verdeel jaarbudget over maanden o.b.v. allowedPctRaw, maar normaliseer zodat som == yearBudget
    let sumRaw = 0;
    const rawBud: Record<number, number> = {};
    for (const m of monthExp) {
      const raw = (allowedPctRaw[m.maand] || 0) * (m.month_exp || 0);
      rawBud[m.maand] = raw;
      sumRaw += raw;
    }
    const scale = sumRaw > 0 ? (yearBudget / sumRaw) : 0;
    const monthBudgetMap: Record<number, number> = {};
    for (const m of monthExp) monthBudgetMap[m.maand] = rawBud[m.maand] * scale;
    const monthBudget = monthBudgetMap[maand] || 0;

    // 6) daggemiddelde per weekdag in geselecteerde maand
    const dayAvgByIso: Record<number, number> = {};
    for (let d = 1; d <= 7; d++) {
      const list = byDay.get(d) || [];
      dayAvgByIso[d] = list.length ? (list[0].day_avg ?? 0) : 0;
    }

    // 7) Gemiddelde omzet per item voor de geselecteerde maand (alle jaren)
    const avgItemRs = await db.query(
      `SELECT COALESCE(SUM(aantal),0) AS items, COALESCE(SUM(aantal*eenheidsprijs),0) AS omzet
       FROM rapportage.omzet
       WHERE EXTRACT(MONTH FROM datum)::int = $1`, [maand]
    );
    const totItems = Number(avgItemRs.rows[0]?.items || 0);
    const totOmzet = Number(avgItemRs.rows[0]?.omzet || 0);
    const avgItemRevMonth = totItems > 0 ? (totOmzet / totItems) : 0;
    const capRevPerStaffQ = itemsPerQ > 0 ? (itemsPerQ * avgItemRevMonth) : 0;

    // 8) Response per weekdag met personeelsvelden
    const weekdays = [];
    for (let d = 1; d <= 7; d++) {
      const { openHour, closeHour } = opening(maand, d);
      const list = (byDay.get(d) || []).filter(r => r.uur >= openHour && r.uur < closeHour);

      // normaliseer q_share binnen deze dag
      const sumQ = list.reduce((acc, r) => acc + (r.q_share_avg ?? 0), 0);
      const qNorm = (r: ProfRow | undefined) =>
        (sumQ > 0 && r?.q_share_avg != null) ? (r.q_share_avg / sumQ) : (1 / Math.max(1, list.length));

      // dagbudget voor deze weekdag (proportioneel naar daggemiddelde)
      const dayBudget = (monthBudget > 0 && monthExpThis > 0)
        ? monthBudget * ((dayAvgByIso[d] || 0) / monthExpThis)
        : 0;

      const slots = [];
      for (let h = openHour; h < closeHour; h++) {
        for (let q = 1; q <= 4; q++) {
          const r = list.find(x => x.uur === h && x.kwartier === q);
          const omzet_avg = r?.omzet_avg ?? 0;
          const from_to = labelFor(h, q);

          const budget_eur = dayBudget * qNorm(r);

          const staff_norm = normRevQ > 0 ? Math.ceil(omzet_avg / normRevQ) : 0;
          const staff_capacity = capRevPerStaffQ > 0 ? Math.ceil(omzet_avg / capRevPerStaffQ) : 0;
          const staff_budget_cap = costPerQ > 0 ? Math.floor(budget_eur / costPerQ) : 0;

          const need = Math.max(staff_norm, staff_capacity);
          const plan = Math.min(staff_budget_cap, need);

          slots.push({
            from_to, uur: h, kwartier: q, omzet_avg,
            budget_eur: Number(budget_eur.toFixed(2)),
            staff_norm, staff_capacity, staff_budget_cap, staff_plan: plan
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
        tuning: { minOcc, maxOcc, pctAtMin, pctAtMax }
      }
    });
  } catch (err: any) {
    console.error("profiel-overzicht error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
