// src/app/admin/planning/forecast/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${text.slice(0, 300)}`);
  if (!ct.includes("application/json")) throw new Error(`Non-JSON response (${ct})`);
  return JSON.parse(text);
};

const maandNamen = ["", "januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];
const fmtEUR0 = (n: number) => new Intl.NumberFormat("nl-NL", { style:"currency", currency:"EUR", maximumFractionDigits:0 }).format(n);
const fmtEUR2 = (n: number) => new Intl.NumberFormat("nl-NL", { style:"currency", currency:"EUR", maximumFractionDigits:2 }).format(n);

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
  return Object.keys(by)
    .map((h) => Number(h))
    .sort((a, b) => a - b)
    .map((h) => ({ uur: h, slots: by[h].sort((a, b) => a.kwartier - b.kwartier) }));
}

export default function ForecastPlanningPage() {
  const nu = new Date();
  const [maand, setMaand] = useState<number>(nu.getMonth() + 1);

  // Personeel toggle (zoals je eerder had)
  const [showStaff, setShowStaff] = useState<boolean>(false);
  const [jaar, setJaar] = useState<number>(nu.getFullYear());
  const [groei, setGroei] = useState<number>(1.03);
  const [norm, setNorm] = useState<number>(100);
  const [costPerQ, setCostPerQ] = useState<number>(6.25);
  const [itemsPerQ, setItemsPerQ] = useState<number>(10);

  // Keuken
  const [kDayStart, setKDayStart] = useState<string>("10:00");
  const [kDayCount, setKDayCount] = useState<number>(1);
  const [kEveCount, setKEveCount] = useState<number>(1);
  const [kCostPerQ, setKCostPerQ] = useState<number>(7.5);

  // Robuuste gemiddelden
  const [robust, setRobust] = useState<boolean>(false);
  const [winsorAlpha, setWinsorAlpha] = useState<number>(0.10);

  const query = useMemo(() => {
    const p = new URLSearchParams({ maand: String(maand) });
    if (robust) {
      p.set("robust", "1");
      p.set("winsor_alpha", String(winsorAlpha));
    }
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
  }, [maand, robust, winsorAlpha, showStaff, jaar, groei, norm, costPerQ, itemsPerQ, kDayStart, kDayCount, kEveCount, kCostPerQ]);

  const { data, error, isLoading } = useSWR(query, fetcher);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Gemiddelde omzet – {maandNamen[maand]}</h1>
        <div className="w-full sm:w-60">
          <label className="block text-sm mb-1">Maand</label>
          <select value={maand} onChange={(e) => setMaand(Number(e.target.value))} className="border rounded px-2 py-1 w-full">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{maandNamen[m]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Toggles */}
      <div className="border rounded-lg p-4 shadow space-y-3">
        <div className="flex flex-wrap items-center gap-6">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="h-4 w-4" checked={robust} onChange={e=>setRobust(e.target.checked)}/>
            <span className="font-semibold">Robuust (winsor {Math.round(winsorAlpha*100)}%)</span>
          </label>
          {robust && (
            <div className="flex items-center gap-2 text-sm">
              <span>alpha</span>
              <input type="number" min={0.01} max={0.25} step={0.01} value={winsorAlpha}
                     onChange={e=>setWinsorAlpha(Number(e.target.value))}
                     className="border rounded px-2 py-1 w-24"/>
            </div>
          )}

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="h-4 w-4" checked={showStaff} onChange={e=>setShowStaff(e.target.checked)}/>
            <span className="font-semibold">Toon personeelsbehoefte</span>
          </label>
        </div>

        {showStaff && (
          <>
            {data?.staff_meta && (
              <div className="text-sm text-gray-700 flex flex-wrap gap-4">
                <span><b>avg €/item:</b> {fmtEUR2(data.staff_meta.avg_item_rev_month || 0)}</span>
                <span><b>cap €/med/kw:</b> {fmtEUR2(data.staff_meta.cap_rev_per_staff_q || 0)}</span>
                <span><b>maandbudget:</b> {fmtEUR0(data.staff_meta.monthBudget || 0)}</span>
                <span><b>occ:</b> {Math.round((data.staff_meta.occ_this || 0)*100)}%</span>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-8 gap-3">
              <div><label className="block text-sm mb-1">Jaar</label>
                <input type="number" value={jaar} onChange={e=>setJaar(Number(e.target.value))} className="border rounded px-2 py-1 w-full"/></div>
              <div><label className="block text-sm mb-1">Groei (×)</label>
                <input type="number" step="0.01" value={groei} onChange={e=>setGroei(Number(e.target.value))} className="border rounded px-2 py-1 w-full"/></div>
              <div><label className="block text-sm mb-1">Norm € / med / kw</label>
                <input type="number" value={norm} onChange={e=>setNorm(Number(e.target.value))} className="border rounded px-2 py-1 w-full"/></div>
              <div><label className="block text-sm mb-1">Kosten € / med / kw</label>
                <input type="number" step="0.01" value={costPerQ} onChange={e=>setCostPerQ(Number(e.target.value))} className="border rounded px-2 py-1 w-full"/></div>
              <div><label className="block text-sm mb-1">Items / med / kw</label>
                <input type="number" value={itemsPerQ} onChange={e=>setItemsPerQ(Number(e.target.value))} className="border rounded px-2 py-1 w-full"/></div>
              <div><label className="block text-sm mb-1">Keuken dag start</label>
                <input type="time" step={900} value={kDayStart} onChange={e=>setKDayStart(e.target.value)} className="border rounded px-2 py-1 w-full"/></div>
              <div><label className="block text-sm mb-1">Keuken dag #</label>
                <input type="number" min={0} value={kDayCount} onChange={e=>setKDayCount(Number(e.target.value))} className="border rounded px-2 py-1 w-full"/></div>
              <div><label className="block text-sm mb-1">Keuken avond #</label>
                <input type="number" min={0} value={kEveCount} onChange={e=>setKEveCount(Number(e.target.value))} className="border rounded px-2 py-1 w-full"/></div>
              <div className="md:col-span-1 xl:col-span-2"><label className="block text-sm mb-1">Keuken € / kw</label>
                <input type="number" step="0.01" value={kCostPerQ} onChange={e=>setKCostPerQ(Number(e.target.value))} className="border rounded px-2 py-1 w-full"/></div>
            </div>
          </>
        )}
      </div>

      {isLoading && <p>Bezig met laden…</p>}
      {error && <p className="text-red-600 text-sm whitespace-pre-wrap">Fout: {String(error.message || error)}</p>}

      {data?.ok && Array.isArray(data?.weekdays) && (
        <div className="space-y-10">
          {data.weekdays.map((wd: any) => {
            const vals = wd.slots.map((s: any) => Number((robust && s.omzet_avg_robust != null) ? s.omzet_avg_robust : s.omzet_avg));
            const min = Math.min(...vals);
            const max = Math.max(...vals);
            const grouped = groupByHour(wd.slots);

            return (
              <div key={wd.isodow} className="border rounded-lg p-4 shadow">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">
                    {wd.naam} <span className="text-sm text-gray-600">({wd.open} – {wd.close})</span>
                  </h2>
                  {robust && <span className="text-xs rounded bg-blue-100 text-blue-800 px-2 py-0.5">winsor {Math.round(winsorAlpha*100)}%</span>}
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full text-sm border-separate border-spacing-y-2">
                    <tbody>
                      {grouped.map((row) => (
                        <tr key={row.uur}>
                          <td className="align-middle pr-2 whitespace-nowrap text-gray-700 w-16 text-right font-medium">
                            {String(row.uur).padStart(2, "0")}:00
                          </td>
                          {row.slots.map((s: any, idx: number) => {
                            const value = robust && s.omzet_avg_robust != null ? s.omzet_avg_robust : s.omzet_avg;
                            const { bg, fg } = heatColor(Number(value || 0), min, max);
                            return (
                              <td key={idx} className="w-1/4">
                                <div
                                  className="rounded-md px-3 py-2 flex flex-col gap-1 shadow-sm border"
                                  style={{ background: bg, color: fg, borderColor: "rgba(0,0,0,0.06)" }}
                                  title={`${s.from_to} • ${fmtEUR0(Number(value || 0))}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-xs sm:text-[13px]">{s.from_to}</span>
                                    <span className="font-semibold">{fmtEUR0(Number(value || 0))}</span>
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
