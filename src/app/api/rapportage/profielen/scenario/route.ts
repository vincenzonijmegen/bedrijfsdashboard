import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";

type MonthShift = { [month1to12: number]: number };

function countWeekdaysInMonth(year:number, month1to12:number, isodow:number){
  let cnt=0;
  const start=new Date(Date.UTC(year,month1to12-1,1));
  const end=new Date(Date.UTC(year,month1to12,0));
  for(let d=new Date(start); d<=end; d=new Date(d.getTime()+86400000)){
    const iso=(((d.getUTCDay()+6)%7)+1);
    if(iso===isodow) cnt++;
  }
  return cnt;
}

async function fetchMonth(base:string, q:Record<string,string|number|boolean>){
  const qs = new URLSearchParams();
  for(const [k,v] of Object.entries(q)){
    if(v===undefined||v===null) continue;
    qs.set(k, String(v));
  }
  const res = await fetch(`${base}/api/rapportage/profielen/overzicht?${qs.toString()}`);
  if(!res.ok){
    const t = await res.text();
    throw new Error(`Overzicht HTTP ${res.status}: ${t.slice(0,240)}`);
  }
  return res.json();
}

export async function POST(req: NextRequest) {
  try{
    const body = await req.json();

    const jaar   = Number(body.jaar ?? new Date().getFullYear());
    const groei  = Number(body.groei ?? 1.03);
    const robust = !!body.robust;
    const winsor = Number(body.winsor_alpha ?? 0.10);
    const block  = Number(body.block_minutes ?? 15);

    const norm     = Number(body.norm ?? 100);
    const costQ    = Number(body.cost_per_q ?? 3.75);
    const itemsQ   = Number(body.items_per_q ?? 10);
    const kStart   = String(body.kitchen_day_start ?? "10:00");
    const kDay     = Number(body.kitchen_day_count ?? 1);
    const kEve     = Number(body.kitchen_eve_count ?? 1);
    const kCostQ   = Number(body.kitchen_cost_per_q ?? 5);
    const openLead = Number(body.open_lead_minutes ?? 30);
    const closeTr  = Number(body.close_trail_minutes ?? 60);
    const startF   = Number(body.startup_front_count ?? 1);
    const cleanF   = Number(body.clean_front_count ?? 2);

    const openShift: MonthShift  = body.open_shift  ?? {};
    const closeShift: MonthShift = body.close_shift ?? {};

    // ISO-weekdagen waarop shifts gelden; kan string "1,2,3,4,5,6" of array [1,2,3,4,5,6] zijn
    const applyShiftIsodow = Array.isArray(body.apply_shift_isodow)
      ? (body.apply_shift_isodow as number[]).filter(n => Number.isInteger(n) && n>=1 && n<=7)
      : (typeof body.apply_shift_isodow === "string" ? body.apply_shift_isodow : "");

    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host  = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if(!host) return NextResponse.json({ok:false, error:"Host niet bekend"}, {status:500});
    const base = `${proto}://${host}`;

    async function getMonthTotals(m:number, withShifts:boolean){
      const json = await fetchMonth(base, {
        maand: m, jaar: jaar, groei: groei,
        block_minutes: block,
        show_staff: 1,
        norm: norm, cost_per_q: costQ, items_per_q: itemsQ,
        kitchen_day_start: kStart, kitchen_day_count: kDay,
        kitchen_eve_count: kEve, kitchen_cost_per_q: kCostQ,
        open_lead_minutes: openLead, close_trail_minutes: closeTr,
        startup_front_count: startF, clean_front_count: cleanF,
        ...(robust ? { robust: 1, winsor_alpha: winsor } : {}),
        ...(withShifts ? {
          open_shift_minutes:  Number(openShift[m]  ?? 0),
          close_shift_minutes: Number(closeShift[m] ?? 0),
          ...(applyShiftIsodow ? {
            apply_shift_isodow: Array.isArray(applyShiftIsodow)
              ? applyShiftIsodow.join(",")
              : String(applyShiftIsodow)
          } : {})
        } : {})
      });

      const revScale = Number(json?.staff_meta?.rev_scale ?? 1);
      let monthRev=0, monthCost=0;

      for (const wd of json?.weekdays ?? []) {
        const iso = Number(wd.isodow);
        const days = countWeekdaysInMonth(jaar, m, iso);

        const dayRev = (wd.slots as any[]).reduce((s,x)=>{
          if (x.slot_type!=="sales") return s;
          const v = Number(x.omzet_avg); // onge-schaald
          return s + v;
        },0) * revScale;

        const front = (wd.slots as any[]).reduce((s,x)=> s + Number(x.staff_plan||0)*Number(x.unit_cost_front||0), 0);
        const kitchen = (wd.slots as any[]).reduce((s,x)=> s + Number(x.kitchen_cost_this_slot||0), 0);
        monthRev  += dayRev  * days;
        monthCost += (front + kitchen) * days;
      }
      return {monthRev, monthCost};
    }

    // baseline (zonder shifts)
    let baseRev=0, baseCost=0;
    for(let m=1;m<=12;m++){
      const r = await getMonthTotals(m, false);
      baseRev  += r.monthRev; baseCost += r.monthCost;
    }

    // scenario (met per-maand shifts)
    let scenRev=0, scenCost=0;
    for(let m=1;m<=12;m++){
      const r = await getMonthTotals(m, true);
      scenRev  += r.monthRev; scenCost += r.monthCost;
    }

    const basePct = baseRev>0 ? (baseCost/baseRev)*100 : 0;
    const scenPct = scenRev>0 ? (scenCost/scenRev)*100 : 0;

    return NextResponse.json({
      ok:true,
      baseline: { revenue: baseRev, cost: baseCost, pct: basePct },
      scenario: { revenue: scenRev, cost: scenCost, pct: scenPct },
      delta: { revenue: scenRev-baseRev, cost: scenCost-baseCost, pct_pt: scenPct-basePct }
    });
  } catch (err:any) {
    console.error("scenario error:", err);
    return NextResponse.json({ok:false, error: err.message},{status:500});
  }
}
