import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const jaar = Number(searchParams.get("jaar") || new Date().getFullYear());
    const groei = Number(searchParams.get("groei") || "1.03");

    const blockMinutes = Number(searchParams.get("block_minutes") || "15");
    const robust = searchParams.get("robust") === "1";
    const winsorAlpha = Number(searchParams.get("winsor_alpha") || "0.10");

    const norm = Number(searchParams.get("norm") || "100");
    const costPerQ = Number(searchParams.get("cost_per_q") || "3.75");
    const itemsPerQ = Number(searchParams.get("items_per_q") || "10");

    const kDayStart = (searchParams.get("kitchen_day_start") || "10:00").trim();
    const kDayCount = Number(searchParams.get("kitchen_day_count") || "1");
    const kEveCount = Number(searchParams.get("kitchen_eve_count") || "1");
    const kCostPerQ = Number(searchParams.get("kitchen_cost_per_q") || "5");

    const openLead = Number(searchParams.get("open_lead_minutes") || "30");
    const closeTrail = Number(searchParams.get("close_trail_minutes") || "60");
    const startupFront = Number(searchParams.get("startup_front_count") || "1");
    const cleanFront = Number(searchParams.get("clean_front_count") || "2");

    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (!host) return NextResponse.json({ ok: false, error: "Host onbekend" }, { status: 500 });
    const base = `${proto}://${host}`;

    let totalRev = 0, totalCost = 0;
    const perMonth: Array<{ maand: number; revenue: number; cost: number; pct: number }> = [];

    for (let m = 1; m <= 12; m++) {
      const qs = new URLSearchParams({
        maand: String(m), jaar: String(jaar), groei: String(groei),
        block_minutes: String(blockMinutes),
        show_staff: "1",
        norm: String(norm), cost_per_q: String(costPerQ), items_per_q: String(itemsPerQ),
        kitchen_day_start: kDayStart, kitchen_day_count: String(kDayCount),
        kitchen_eve_count: String(kEveCount), kitchen_cost_per_q: String(kCostPerQ),
        open_lead_minutes: String(openLead), close_trail_minutes: String(closeTrail),
        startup_front_count: String(startupFront), clean_front_count: String(cleanFront),
      });
      if (robust) { qs.set("robust", "1"); qs.set("winsor_alpha", String(winsorAlpha)); }

      const res = await fetch(`${base}/api/rapportage/profielen/overzicht?${qs.toString()}`);
      if (!res.ok) return NextResponse.json({ ok: false, error: `Overzicht ${m}: ${res.status}` }, { status: 500 });
      const json = await res.json();

      const revScale = Number(json?.staff_meta?.rev_scale ?? 1);
      let monthRev = 0, monthCost = 0;

      for (const wd of json?.weekdays ?? []) {
        const iso = Number(wd.isodow);
        const days = countWeekdaysInMonth(jaar, m, iso);
        const dayRev = (wd.slots as any[]).reduce((s,x)=>{
          if (x.slot_type!=="sales") return s;
          const v = Number(robust && x.omzet_avg_robust!=null ? x.omzet_avg_robust : x.omzet_avg);
          return s+v;
        },0) * revScale;

        const front = (wd.slots as any[]).reduce((s,x)=> s + Number(x.staff_plan||0) * Number(x.unit_cost_front||0), 0);
        const kitchen = (wd.slots as any[]).reduce((s,x)=> s + Number(x.kitchen_cost_this_slot||0), 0);
        monthRev  += dayRev  * days;
        monthCost += (front + kitchen) * days;
      }

      totalRev += monthRev; totalCost += monthCost;
      perMonth.push({ maand: m, revenue: monthRev, cost: monthCost, pct: monthRev>0 ? (monthCost/monthRev)*100 : 0 });
    }

    const pct = totalRev>0 ? (totalCost/totalRev)*100 : 0;
    return NextResponse.json({
      ok: true,
      totals: { revenue: totalRev, cost: totalCost, pct },
      per_month: perMonth
    });
  } catch (err:any) {
    console.error("yearcheck error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
