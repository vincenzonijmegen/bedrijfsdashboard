// src/app/api/rapportage/profielen/overzicht/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ProfRow = {
  isodow: number;
  uur: number;
  kwartier: number;
  omzet_avg: number;
  q_share_avg: number | null;
  day_avg: number | null; // dagomzet_avg (gemiddeld) voor deze maand×weekdag
};
type MonthExpRow = { maand: number; month_exp: number };

const WD_NL = ["", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];
const MONTH_NL = [
  "", "januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"
];

const PAD = (n: number) => String(n).padStart(2, "0");
const labelFor = (uur: number, kwartier: number) => {
  const startMin = (kwartier - 1) * 15;
  const endMin = startMin + 15;
  const h2 = uur + Math.floor(endMin / 60);
  const m2 = endMin % 60;
  return `${PAD(uur)}:${PAD(startMin)} - ${PAD(h2)}:${PAD(m2)}`;
};

function opening(maand: number, isodow: number) {
  // Alleen verkooptijden (zoals jouw lijst): zonder opstart/schoonmaak
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

    // Personeels-toggle + parameters (optioneel)
    const includeStaff = searchParams.get("show_staff") === "1"; // UI-toggle
    const jaar = Number(searchParams.get("jaar") || new Date().getFullYear());
    const groei = Number(searchParams.get("groei") || "1.03");

    const normRevQ = Number(searchParams.get("norm") || "0");        // € omzet per medewerker per kwartier (doorzetnorm)
    const costPerQ = Number(searchParams.get("cost_per_q") || "0");   // loonkosten per medewerker per kwartier
    const avgItemRev = Number(searchParams.get("avg_item_rev") || "0");      // € / item
    const capItemsPerStaffQ = Number(searchParams.get("cap_items_q") || "0"); // max items per medewerker per kwartier

    // DB
    const mod = await import("@/lib/dbRapportage");
    const db = mod.dbRapportage;

    // 1) Lees profiel-rijen voor geselecteerde maand (incl. q_share_avg en daggemiddelde)
    const sqlMonthRows = `
      SELECT p.isodow::int, p.uur::int, p.kwartier::int,
             p.omzet_avg::numeric,
             COALESCE(p.q_share_avg, NULL)::numeric AS q_share_avg,
             -- daggemiddelde omzet per (maand,isodow): neem het gemiddelde van dagomzet_avg over de kwartieren
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

    // Bouw opzoekstructuren per weekdag
    const byDay = new Map<number, ProfRow[]>();
    rows.forEach((r) => {
      if (!byDay.has(r.isodow)) byDay.set(r.isodow, []);
      byDay.get(r.isodow)!.push(r);
    });

    // 2) (Alleen bij personeels-toggle) → bereken month share en budgetverdeling op basis van profielen
    let meta: any = null;
    let monthBudget = 0;
    let monthPct = 0;
    let yearBudget = 0;
    let yearTarget = 0;
    let yearPrev = 0;
    let monthExpThis = 0;
    let yearExp = 0;
    let dayAvgByIso: Record<number, number> = {};

    if (includeStaff) {
      // 2a) Jaaromzet vorig jaar uit ruwe tabel
      const prevRs = await db.query(
        `SELECT COALESCE(SUM(aantal * eenheidsprijs),0) AS y FROM rapportage.omzet WHERE EXTRACT(YEAR FROM datum)::int = $1`,
        [jaar - 1]
      );
      yearPrev = Number(prevRs.rows[0]?.y || 0);
      yearTarget = Math.round(yearPrev * (isFinite(groei) && groei > 0 ? groei : 1.0));
      yearBudget = yearTarget * 0.23;

      // 2b) Verwachte maandomzet per maand (op basis van profielen × #dagen)
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
      const monthExp: MonthExpRow[] = mexp.rows.map((r: any) => ({
        maand: Number(r.maand),
        month_exp: Number(r.month_exp || 0),
      }));
      yearExp = monthExp.reduce((a, b) => a + b.month_exp, 0);
      monthExpThis = monthExp.find((x) => x.maand === maand)?.month_exp || 0;
      monthPct = yearExp > 0 ? monthExpThis / yearExp : 0;
      monthBudget = yearBudget * monthPct;

      // 2c) day_avg per isodow voor deze maand (uit rows)
      for (const d of [1,2,3,4,5,6,7]) {
        const list = byDay.get(d) || [];
        const avg = list.length ? (list[0].day_avg ?? 0) : 0; // dagomzet_avg is gelijk over kwartieren
        dayAvgByIso[d] = avg;
      }

      meta = {
        jaar,
        groei,
        yearPrev,
        yearTarget,
        yearBudget,
        monthPct,
        monthBudget,
        monthExpThis,
        yearExp,
      };
    }

    // 3) Assembleer response per weekdag met slots + (optioneel) personeelswaarden
    const weekdays: Array<{
      isodow: number;
      naam: string;
      open: string;
      close: string;
      slots: Array<{
        from_to: string;
        uur: number;
        kwartier: number;
        omzet_avg: number;
        // personeelsvelden (bij includeStaff)
        budget_eur?: number;
        staff_norm?: number;
        staff_capacity?: number;
        staff_budget_cap?: number;
        staff_plan?: number;
      }>;
    }> = [];

    for (let d = 1; d <= 7; d++) {
      const { openHour, closeHour } = opening(maand, d);
      const list = (byDay.get(d) || []).filter(
        (r) => r.uur >= openHour && r.uur < closeHour
      );

      // normaliseer q_share per dag (zodat som 1 is)
      const sumQ = list.reduce((acc, r) => acc + (r.q_share_avg ?? 0), 0);
      const qNorm = (r: ProfRow) =>
        sumQ > 0 && r.q_share_avg !== null ? r.q_share_avg / sumQ : 1 / (list.length || 1);

      // per-dag budget (alleen bij includeStaff)
      const dayBudget =
        includeStaff && monthBudget > 0 && monthExpThis > 0
          ? (monthBudget * (dayAvgByIso[d] || 0)) / monthExpThis
          : 0;

      const slots: any[] = [];

      for (let h = openHour; h < closeHour; h++) {
        for (let q = 1; q <= 4; q++) {
          const r = list.find((x) => x.uur === h && x.kwartier === q);
          const omzet_avg = r?.omzet_avg ?? 0;
          const from_to = labelFor(h, q);

          if (!includeStaff) {
            slots.push({ from_to, uur: h, kwartier: q, omzet_avg });
            continue;
          }

          const budget_eur = dayBudget * qNorm(r || { q_share_avg: null } as ProfRow);

          // 3 constraints:
          // a) doorzetnorm: omzet per medewerker per kwartier
          const staff_norm =
            normRevQ > 0 ? Math.ceil(omzet_avg / normRevQ) : 0;

          // b) capaciteitsnorm: items per staff per kwartier
          const staff_capacity =
            avgItemRev > 0 && capItemsPerStaffQ > 0
              ? Math.ceil((omzet_avg / avgItemRev) / capItemsPerStaffQ)
              : 0;

          // c) budgetplafond: max medewerkers binnen budget
          const staff_budget_cap =
            costPerQ > 0 ? Math.floor(budget_eur / costPerQ) : 0;

          const need = Math.max(staff_norm || 0, staff_capacity || 0);
          const plan = Math.min(
            staff_budget_cap || 0,
            need || 0
          );

          slots.push({
            from_to, uur: h, kwartier: q, omzet_avg,
            budget_eur: Number(budget_eur.toFixed(2)),
            staff_norm: staff_norm || 0,
            staff_capacity: staff_capacity || 0,
            staff_budget_cap: staff_budget_cap || 0,
            staff_plan: plan || 0,
          });
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
      weekdays,
      staff_meta: includeStaff ? meta : undefined,
    });
  } catch (err: any) {
    console.error("profiel-overzicht error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
