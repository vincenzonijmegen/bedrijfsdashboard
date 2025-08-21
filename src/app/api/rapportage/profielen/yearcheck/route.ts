// src/app/api/rapportage/profielen/yearcheck/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Server-side jaarcheck:
 * - Loopt 12 maanden langs
 * - Voor elke maand haalt 'ie de bestaande /profielen/overzicht route op (unified methode)
 * - Berekent dagomzet (alleen sales) en personeelskosten (front Plan + keuken over ALLE blokken)
 * - Vermenigvuldigt per weekdag met het aantal dagen in die maand
 * - Sommeert naar jaartotalen en geeft % terug
 *
 * Voordeel: zelfde logica als de maand-overview wordt gebruikt, dus UI en jaarcheck zijn consistent.
 */

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    // Parameters (defaults gelijk aan de unified methode)
    const jaar = Number(searchParams.get("jaar") || new Date().getFullYear());
    const groei = Number(searchParams.get("groei") || "1.03");

    const blockMinutes = Number(searchParams.get("block_minutes") || "15"); // 15 | 30
    const robust = searchParams.get("robust") === "1";
    const winsorAlpha = Number(searchParams.get("winsor_alpha") || "0.10");

    const norm = Number(searchParams.get("norm") || "100"); // € / med / 15m
    const costPerQ = Number(searchParams.get("cost_per_q") || "3.75"); // front €/15m (AANGEPAST default)
    const itemsPerQ = Number(searchParams.get("items_per_q") || "10");

    const kDayStart = (searchParams.get("kitchen_day_start") || "10:00").trim();
    const kDayCount = Number(searchParams.get("kitchen_day_count") || "1");
    const kEveCount = Number(searchParams.get("kitchen_eve_count") || "1");
    const kCostPerQ = Number(searchParams.get("kitchen_cost_per_q") || "5"); // keuken €/15m (AANGEPAST default)

    const openLead = Number(searchParams.get("open_lead_minutes") || "30");
    const closeTrail = Number(searchParams.get("close_trail_minutes") || "60");
    const startupFront = Number(searchParams.get("startup_front_count") || "1");
    const cleanFront = Number(searchParams.get("clean_front_count") || "2");

    // origin voor interne fetch naar /overzicht
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (!host) {
      return NextResponse.json({ ok: false, error: "Kan host niet bepalen voor interne verzoeken." }, { status: 500 });
    }
    const base = `${proto}://${host}`;

    let totalRev = 0;
    let totalCost = 0;

    const perMonth: Array<{ maand: number; revenue: number; cost: number; pct: number }> = [];

    // Loop alle maanden 1..12
    for (let m = 1; m <= 12; m++) {
      const qs = new URLSearchParams({
        maand: String(m),
        jaar: String(jaar),
        groei: String(groei),
        block_minutes: String(blockMinutes),
        show_staff: "1",
        // unified methode in de /overzicht route is default; we hoeven budget_mode niet te zetten
        norm: String(norm),
        cost_per_q: String(costPerQ),
        items_per_q: String(itemsPerQ),
        kitchen_day_start: kDayStart,
        kitchen_day_count: String(kDayCount),
        kitchen_eve_count: String(kEveCount),
        kitchen_cost_per_q: String(kCostPerQ),
        open_lead_minutes: String(openLead),
        close_trail_minutes: String(closeTrail),
        startup_front_count: String(startupFront),
        clean_front_count: String(cleanFront),
      });
      if (robust) {
        qs.set("robust", "1");
        qs.set("winsor_alpha", String(winsorAlpha));
      }

      const res = await fetch(`${base}/api/rapportage/profielen/overzicht?${qs.toString()}`, {
        method: "GET",
        headers: { "x-internal-yearcheck": "1" },
        // Vercel node runtime: fetch naar eigen origin is toegestaan
      });

      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          { ok: false, error: `Fout bij ophalen overzicht maand ${m}: HTTP ${res.status} ${text.slice(0, 300)}` },
          { status: 500 }
        );
      }

      const monthJson = await res.json();
      const revScale = Number(monthJson?.staff_meta?.rev_scale ?? 1);

      let monthRevenue = 0;
      let monthCost = 0;

      // Per weekdag: dagomzet (alleen sales, geschaald) en dagkosten (front+keuken over alle blokken)
      for (const wd of monthJson?.weekdays ?? []) {
        const iso = Number(wd.isodow);
        const days = countWeekdaysInMonth(jaar, m, iso as 1 | 2 | 3 | 4 | 5 | 6 | 7);

        // dagomzet (alleen sales), geschaald met rev_scale
        const dayRev = (wd.slots as any[]).reduce((sum, s) => {
          if (s.slot_type !== "sales") return sum;
          const v = Number(
            robust && s.omzet_avg_robust != null ? s.omzet_avg_robust : s.omzet_avg
          );
          return sum + v;
        }, 0) * revScale;

        // dagkosten (front: staff_plan * unit_cost_front over alle blokken) + keuken (alle blokken)
        const frontCost = (wd.slots as any[]).reduce(
          (sum, s) => sum + Number(s.staff_plan || 0) * Number(s.unit_cost_front || 0),
          0
        );
        const kitchenCost = (wd.slots as any[]).reduce(
          (sum, s) => sum + Number(s.kitchen_cost_this_slot || 0),
          0
        );
        const dayCost = frontCost + kitchenCost;

        monthRevenue += dayRev * days;
        monthCost += dayCost * days;
      }

      totalRev += monthRevenue;
      totalCost += monthCost;

      perMonth.push({
        maand: m,
        revenue: monthRevenue,
        cost: monthCost,
        pct: monthRevenue > 0 ? (monthCost / monthRevenue) * 100 : 0,
      });
    }

    const pct = totalRev > 0 ? (totalCost / totalRev) * 100 : 0;

    return NextResponse.json({
      ok: true,
      params: {
        jaar,
        groei,
        block_minutes: blockMinutes,
        robust,
        winsor_alpha: robust ? winsorAlpha : undefined,
        norm,
        cost_per_q: costPerQ,
        items_per_q: itemsPerQ,
        kitchen_day_start: kDayStart,
        kitchen_day_count: kDayCount,
        kitchen_eve_count: kEveCount,
        kitchen_cost_per_q: kCostPerQ,
        open_lead_minutes: openLead,
        close_trail_minutes: closeTrail,
        startup_front_count: startupFront,
        clean_front_count: cleanFront,
      },
      totals: {
        revenue: totalRev,
        cost: totalCost,
        pct,
      },
      per_month: perMonth,
    });
  } catch (err: any) {
    console.error("yearcheck error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
