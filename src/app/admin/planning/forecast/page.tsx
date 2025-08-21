// src/app/admin/planning/forecast/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";

/* ------------ helpers ------------ */
const fetcher = async (url: string) => {
  const res = await fetch(url);
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${text.slice(0, 300)}`);
  if (!ct.includes("application/json")) throw new Error(`Non-JSON response (${ct})`);
  return JSON.parse(text);
};

const maandNamen = [
  "", "januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"
];

const fmtEUR0 = (n: number) =>
  new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR",maximumFractionDigits:0})
    .format(Number.isFinite(n)?n:0);
const fmtEUR2 = (n: number) =>
  new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR",maximumFractionDigits:2})
    .format(Number.isFinite(n)?n:0);
const fmtPct1 = (n: number) =>
  new Intl.NumberFormat("nl-NL",{minimumFractionDigits:1,maximumFractionDigits:1})
    .format(Number.isFinite(n)?n:0);

function heatColor(value: number, min: number, max: number) {
  if (!isFinite(value) || max <= min) return { bg: "hsl(210 40% 94%)", fg: "#111" };
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const lightness = 92 - t * 50;
  const bg = `hsl(210 70% ${lightness}%)`;
  const fg = lightness < 55 ? "#fff" : "#111";
  return { bg, fg };
}
function groupByHour(slots: any[]) {
  const by: Record<number, any[]> = {};
  for (const s of slots) (by[s.uur] ??= []).push(s);
  return Object.keys(by).map(Number).sort((a,b)=>a-b).map(h=>({ uur:h, slots: by[h] }));
}

/* ------------ page ------------ */
export default function ForecastPlanningPage() {
  const nu = new Date();
  const [maand, setMaand] = useState<number>(nu.getMonth()+1);

  // Robuust (winsor)
  const [robust, setRobust] = useState(false);
  const [winsorAlpha, setWinsorAlpha] = useState(0.10);

  // Personeel
  const [showStaff, setShowStaff] = useState(false);
  const [jaar, setJaar] = useState(nu.getFullYear());
  const [groei, setGroei] = useState(1.03);
  const [norm, setNorm] = useState(100);      // €/med/15m
  const [costPerQ, setCostPerQ] = useState(3.75); // €/15m front (AANGEPAST default)
  const [itemsPerQ, setItemsPerQ] = useState(10); // items/med/15m

  // Keuken baseline
  const [kDayStart, setKDayStart] = useState("10:00");
  const [kDayCount, setKDayCount] = useState(1);
  const [kEveCount, setKEveCount] = useState(1);
  const [kCostPerQ, setKCostPerQ] = useState(5); // €/15m keuken (AANGEPAST default)

  // NS-blokken
  const [openLead, setOpenLead] = useState(30);
  const [closeTrail, setCloseTrail] = useState(60);
  const [startupFront, setStartupFront] = useState(1); // front; totaal opstart = 2 incl 1 keuken
  const [cleanFront, setCleanFront] = useState(2);     // front; totaal schoonmaak = 3 incl 1 keuken

  // Blokgrootte
  const [blockMinutes, setBlockMinutes] = useState<15|30>(15);

  // (UI behoudt deze, unified route negeert budget_mode intern)
  const [budgetMode, setBudgetMode] = useState<"monthly"|"slot">("monthly");

  // Jaarcheck state (nu via server-side endpoint)
  const [yearCheck, setYearCheck] = useState<{rev:number; cost:number; pct:number} | null>(null);
  const [perMonth, setPerMonth] = useState<Array<{maand:number; revenue:number; cost:number; pct:number}>>([]);
  const [checking, setChecking] = useState(false);
  const [checkErr, setCheckErr] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams({
      maand: String(maand),
      block_minutes: String(blockMinutes),
      open_lead_minutes: String(openLead),
      close_trail_minutes: String(closeTrail),
      startup_front_count: String(startupFront),
      clean_front_count: String(cleanFront),
      budget_mode: budgetMode,
    });
    if (robust) { p.set("robust","1"); p.set("winsor_alpha", String(winsorAlpha)); }
    if (showStaff) {
      p.set("show_staff", "1");
      p.set("jaar", String(jaar));
      p.set("groei", String(groei));
      p.set("norm", String(norm));
      p.set("cost_per_q", String(costPerQ));
      p.set("items_per_q", String(itemsPerQ));
      p.set("kitchen_day_start", kDayStart);
      p.set("kitchen_day_count", String(kDayCount));
      p.set("kitchen_eve_count", String(kEveCount));
      p.set("kitchen_cost_per_q", String(kCostPerQ));
    }
    return `/api/rapportage/profielen/overzicht?${p.toString()}`;
  }, [
    maand, blockMinutes, openLead, closeTrail, startupFront, cleanFront,
    budgetMode, robust, winsorAlpha, showStaff, jaar, groei, norm, costPerQ, itemsPerQ,
    kDayStart, kDayCount, kEveCount, kCostPerQ
  ]);

  const { data, error, isLoading } = useSWR(query, fetcher);

  async function runYearCheck(){
    try{
      setChecking(true);
      setCheckErr(null);
      setYearCheck(null);
      setPerMonth([]);

      const qs = new URLSearchParams({
        jaar: String(jaar),
        groei: String(groei),
        block_minutes: String(blockMinutes),
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
        qs.set("robust","1");
        qs.set("winsor_alpha", String(winsorAlpha));
      }

      const res = await fetch(`/api/rapportage/profielen/yearcheck?${qs.toString()}`);
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`HTTP ${res.status}: ${t.slice(0, 300)}`);
      }
      const json = await res.json();
      const totals = json?.totals || {};
      setYearCheck({
        rev: Number(totals.revenue || 0),
        cost: Number(totals.cost || 0),
        pct: Number(totals.pct || 0),
      });
      setPerMonth(Array.isArray(json?.per_month) ? json.per_month : []);
    } catch (e:any) {
      setCheckErr(e?.message || String(e));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Titel + maand + blokgrootte + budgetmode */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Gemiddelde omzet – {maandNamen[maand]}</h1>
        <div className="flex items-end gap-4 flex-wrap">
          <div className="w-44">
            <label className="block text-sm mb-1">Maand</label>
            <select value={maand} onChange={e=>setMaand(Number(e.target.value))} className="border rounded px-2 py-1 w-full">
              {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{maandNamen[m]}</option>)}
            </select>
          </div>
          <div className="w-40">
            <label className="block text-sm mb-1">Blok</label>
            <select value={blockMinutes} onChange={e=>setBlockMinutes(Number(e.target.value) as 15|30)} className="border rounded px-2 py-1 w-full">
              <option value={15}>15 minuten</option>
              <option value={30}>30 minuten</option>
            </select>
          </div>
          <div className="w-64">
            <label className="block text-sm mb-1">Budgetmethode</label>
            <select value={budgetMode} onChange={e=>setBudgetMode(e.target.value as any)} className="border rounded px-2 py-1 w-full">
              <option value="monthly">Maandbudget (compenseert)</option>
              <option value="slot">23% per blok (direct)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Toggles & instellingen */}
      <div className="border rounded-lg p-4 shadow space-y-3">
        <div className="flex flex-wrap items-center gap-6">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="h-4 w-4" checked={robust} onChange={e=>setRobust(e.target.checked)} />
            <span className="font-semibold">Robuust (winsor {Math.round(winsorAlpha*100)}%)</span>
          </label>
          {robust && (
            <div className="flex items-center gap-2 text-sm">
              <span>alpha</span>
              <input type="number" min={0.01} max={0.25} step={0.01} value={winsorAlpha}
                     onChange={e=>setWinsorAlpha(Number(e.target.value))}
                     className="border rounded px-2 py-1 w-24" />
            </div>
          )}

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="h-4 w-4" checked={showStaff} onChange={e=>setShowStaff(e.target.checked)} />
            <span className="font-semibold">Toon personeelsbehoefte</span>
          </label>

          {/* Jaarcheck knop + resultaten (server-side) */}
          <div className="flex items-center gap-3 ml-auto flex-wrap">
            <button onClick={runYearCheck} disabled={checking}
              className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {checking ? "Jaarcheck…" : "Jaarcheck 23% (server)"}
            </button>
            {yearCheck && (
              <span className="text-sm text-gray-700">
                Jaaromzet <b>{fmtEUR0(yearCheck.rev)}</b> • Personeel <b>{fmtEUR0(yearCheck.cost)}</b> • <b>{fmtPct1(yearCheck.pct)}</b>%
              </span>
            )}
            {checkErr && <span className="text-sm text-rose-700">{checkErr}</span>}
          </div>
        </div>

        {showStaff && (
          <>
            {/* Staff instellingen */}
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-8 gap-3">
              <div><label className="block text-sm mb-1">Jaar</label>
                <input type="number" value={jaar} onChange={e=>setJaar(Number(e.target.value))}
                       className="border rounded px-2 py-1 w-full" /></div>
              <div><label className="block text-sm mb-1">Groei (×)</label>
                <input type="number" step="0.01" value={groei} onChange={e=>setGroei(Number(e.target.value))}
                       className="border rounded px-2 py-1 w-full" /></div>
              <div><label className="block text-sm mb-1">Norm € / med / 15m</label>
                <input type="number" value={norm} onChange={e=>setNorm(Number(e.target.value))}
                       className="border rounded px-2 py-1 w-full" /></div>
              <div><label className="block text-sm mb-1">Kosten € / 15m (front)</label>
                <input type="number" step="0.01" value={costPerQ} onChange={e=>setCostPerQ(Number(e.target.value))}
                       className="border rounded px-2 py-1 w-full" /></div>
              <div><label className="block text-sm mb-1">Items / med / 15m</label>
                <input type="number" value={itemsPerQ} onChange={e=>setItemsPerQ(Number(e.target.value))}
                       className="border rounded px-2 py-1 w-full" /></div>

              {/* Keuken & NS-blokken */}
              <div><label className="block text-sm mb-1">Keuken dag start</label>
                <input type="time" step={900} value={kDayStart} onChange={e=>setKDayStart(e.target.value)}
                       className="border rounded px-2 py-1 w-full" /></div>
              <div><label className="block text-sm mb-1">Keuken dag #</label>
                <input type="number" min={0} value={kDayCount} onChange={e=>setKDayCount(Number(e.target.value))}
                       className="border rounded px-2 py-1 w-full" /></div>
              <div><label className="block text-sm mb-1">Keuken avond #</label>
                <input type="number" min={0} value={kEveCount} onChange={e=>setKEveCount(Number(e.target.value))}
                       className="border rounded px-2 py-1 w-full" /></div>
              <div className="md:col-span-1 xl:col-span-2"><label className="block text-sm mb-1">Keuken € / 15m</label>
                <input type="number" step="0.01" value={kCostPerQ} onChange={e=>setKCostPerQ(Number(e.target.value))}
                       className="border rounded px-2 py-1 w-full" /></div>

              <div><label className="block text-sm mb-1">Opstart (min voor open)</label>
                <input type="number" min={0} step={15} value={openLead} onChange={e=>setOpenLead(Number(e.target.value))}
                       className="border rounded px-2 py-1 w-full" /></div>
              <div><label className="block text-sm mb-1">Schoonmaak (min na sluit)</label>
                <input type="number" min={0} step={15} value={closeTrail} onChange={e=>setCloseTrail(Number(e.target.value))}
                       className="border rounded px-2 py-1 w-full" /></div>
              <div><label className="block text-sm mb-1">Front opstart (#)</label>
                <input type="number" min={0} value={startupFront} onChange={e=>setStartupFront(Number(e.target.value))}
                       className="border rounded px-2 py-1 w-full" /></div>
              <div><label className="block text-sm mb-1">Front schoonmaak (#)</label>
                <input type="number" min={0} value={cleanFront} onChange={e=>setCleanFront(Number(e.target.value))}
                       className="border rounded px-2 py-1 w-full" /></div>
            </div>
          </>
        )}

        {/* (optioneel) detail weergave van jaarcheck per maand */}
        {yearCheck && perMonth.length > 0 && (
          <div className="mt-3 rounded border p-3">
            <div className="text-sm font-semibold mb-2">Jaarcheck per maand</div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {perMonth.map((m) => (
                <div key={m.maand} className="border rounded px-3 py-2 text-sm flex items-center justify-between">
                  <span>{maandNamen[m.maand]}</span>
                  <span>
                    {fmtEUR0(m.revenue)} • {fmtEUR0(m.cost)} • <b>{fmtPct1(m.pct)}</b>%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Status */}
      {isLoading && <p>Bezig met laden…</p>}
      {error && <p className="text-red-600 text-sm whitespace-pre-wrap">Fout: {String(error.message || error)}</p>}

      {/* Overzicht per weekdag */}
      {data?.ok && Array.isArray(data?.weekdays) && (
        <div className="space-y-10">
          {data.weekdays.map((wd: any) => {
            // Heatmap op basis van omzet (pre/clean = 0)
            const vals = wd.slots.map((s: any) =>
              Number(robust && s.omzet_avg_robust != null ? s.omzet_avg_robust : s.omzet_avg)
            );
            const min = Math.min(...vals);
            const max = Math.max(...vals);
            const grouped = groupByHour(wd.slots);

            // Dagomzet (alleen sales-blokken) — schaal met rev_scale indien aanwezig
            const revScale = Number(data?.staff_meta?.rev_scale ?? 1);
            const dayRevenue = wd.slots.reduce((sum: number, s: any) => {
              if (s.slot_type !== "sales") return sum;
              const v = Number(robust && s.omzet_avg_robust != null ? s.omzet_avg_robust : s.omzet_avg);
              return sum + v;
            }, 0) * revScale;

            // Personeelskosten header (Plan): front (Plan) + keuken (alle blokken)
            let headerCostNode: React.ReactNode = null;
            if (showStaff) {
              const frontPlanCost = wd.slots.reduce(
                (sum: number, s: any) => sum + (Number(s.staff_plan || 0) * Number(s.unit_cost_front || 0)),
                0
              );
              const kitchenCostAll = wd.slots.reduce(
                (sum: number, s: any) => sum + Number(s.kitchen_cost_this_slot || 0),
                0
              );
              const totalCost = frontPlanCost + kitchenCostAll;
              const pctCost   = dayRevenue > 0 ? (totalCost / dayRevenue) * 100 : 0;

              headerCostNode = (
                <span className="text-sm text-gray-700">
                  • Dagomzet: <b>{fmtEUR0(dayRevenue)}</b>
                  {"  "}• Personeelskosten (Plan): <b>{fmtEUR0(totalCost)}</b>
                  {"  "}(<b>{fmtPct1(pctCost)}</b>%)
                  <span className="opacity-80"> — front {fmtEUR0(frontPlanCost)}, keuken {fmtEUR0(kitchenCostAll)}</span>
                </span>
              );
            } else {
              headerCostNode = (
                <span className="text-sm text-gray-700">
                  • Dagomzet: <b>{fmtEUR0(dayRevenue)}</b>
                </span>
              );
            }

            return (
              <div key={wd.isodow} className="border rounded-lg p-4 shadow">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold flex items-center gap-2 flex-wrap">
                    <span>
                      {wd.naam} <span className="text-sm text-gray-600">({wd.open} – {wd.close})</span>
                    </span>
                    {headerCostNode}
                  </h2>
                  <div className="hidden sm:flex items-center gap-2 text-xs text-gray-600">
                    <span>laag</span>
                    <div className="h-3 w-16 rounded" style={{ background: "hsl(210 70% 92%)" }} />
                    <div className="h-3 w-16 rounded" style={{ background: "hsl(210 70% 72%)" }} />
                    <div className="h-3 w-16 rounded" style={{ background: "hsl(210 70% 52%)" }} />
                    <span>hoog</span>
                  </div>
                </div>

                {/* Tabel per uur */}
                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full text-sm border-separate border-spacing-y-2">
                    <tbody>
                      {grouped.map((row) => (
                        <tr key={row.uur}>
                          <td className="align-middle pr-2 whitespace-nowrap text-gray-700 w-16 text-right font-medium">
                            {String(row.uur).padStart(2, "0")}:00
                          </td>
                          {row.slots.map((s: any, idx: number) => {
                            const value = Number(robust && s.omzet_avg_robust != null ? s.omzet_avg_robust : s.omzet_avg);
                            const { bg, fg } = heatColor(value, min, max);
                            return (
                              <td key={idx} className={data?.block_minutes===30 ? "w-1/2" : "w-1/4"}>
                                <div
                                  className={`rounded-md px-3 py-2 flex flex-col gap-1 shadow-sm border ${s.slot_type!=="sales" ? "opacity-95 ring-1 ring-gray-300" : ""}`}
                                  style={{ background: bg, color: fg, borderColor: "rgba(0,0,0,0.06)" }}
                                  title={`${s.from_to} • ${fmtEUR0(value)}${s.slot_type!=="sales" ? " (niet-verkoopblok)" : ""}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-xs sm:text-[13px]">
                                      {s.from_to}{s.slot_type!=="sales" ? " • NS" : ""}
                                    </span>
                                    <span className="font-semibold">{fmtEUR0(value)}</span>
                                  </div>

                                  {showStaff && (
                                    <div className="flex items-center justify-between text-xs opacity-90">
                                      <span>
                                        N {s.staff_norm ?? 0}
                                        {(s.staff_capacity ?? 0) > 0 && ` | Cap ${s.staff_capacity}`}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        Bud {s.staff_budget_cap ?? 0} ➜ Plan <strong>{s.staff_plan ?? 0}</strong>
                                        {s.over_budget ? (
                                          <span className="inline-flex items-center gap-1 text-rose-700">
                                            <span className="inline-block h-2 w-2 rounded-full bg-rose-600" />
                                            {`+${fmtEUR2(s.budget_gap_eur || 0)}`}
                                          </span>
                                        ) : null}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
