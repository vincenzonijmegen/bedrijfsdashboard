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

const maandNamen = [
  "", "januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"
];

const fmtEUR0 = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const fmtEUR2 = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);

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

  // Toggle personeel
  const [showStaff, setShowStaff] = useState<boolean>(false);
  const [jaar, setJaar] = useState<number>(nu.getFullYear());
  const [groei, setGroei] = useState<number>(1.03);
  const [norm, setNorm] = useState<number>(100);          // € omzet / medewerker / kwartier
  const [costPerQ, setCostPerQ] = useState<number>(3.75); // € 15/u
  const [itemsPerQ, setItemsPerQ] = useState<number>(10); // 10 items / kwartier / medewerker

  const query = useMemo(() => {
    const p = new URLSearchParams({ maand: String(maand) });
    if (showStaff) {
      p.set("show_staff", "1");
      p.set("jaar", String(jaar));
      p.set("groei", String(groei));
      p.set("norm", String(norm));
      p.set("cost_per_q", String(costPerQ));
      p.set("items_per_q", String(itemsPerQ));
      // geavanceerde tuning? -> p.set("min_occ","0.40"), p.set("max_occ","0.80"), p.set("pct_at_min_occ","0.30"), p.set("pct_at_max_occ","0.18")
    }
    return `/api/rapportage/profielen/overzicht?${p.toString()}`;
  }, [maand, showStaff, jaar, groei, norm, costPerQ, itemsPerQ]);

  const { data, error, isLoading } = useSWR(query, fetcher);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Gemiddelde omzet – {maandNamen[maand]}</h1>
        <div className="w-full sm:w-60">
          <label className="block text-sm mb-1">Maand</label>
          <select value={maand} onChange={(e) => setMaand(Number(e.target.value))}
                  className="border rounded px-2 py-1 w-full">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{maandNamen[m]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Toggle personeel */}
      <div className="border rounded-lg p-4 shadow space-y-3">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="h-4 w-4" checked={showStaff} onChange={e=>setShowStaff(e.target.checked)}/>
          <span className="font-semibold">Toon personeelsbehoefte (23% per maand geherweeg + schepcapaciteit)</span>
        </label>
        {showStaff && (
          <>
            {/* korte meta */}
            {data?.staff_meta && (
              <div className="text-sm text-gray-700 flex flex-wrap gap-4">
                <span><b>avg €/item:</b> {fmtEUR2(data.staff_meta.avg_item_rev_month || 0)}</span>
                <span><b>cap €/med/kw:</b> {fmtEUR2(data.staff_meta.cap_rev_per_staff_q || 0)}</span>
                <span><b>maandbudget:</b> {fmtEUR0(data.staff_meta.monthBudget || 0)}</span>
                <span><b>occ:</b> {Math.round((data.staff_meta.occ_this || 0)*100)}%</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <div>
                <label className="block text-sm mb-1">Jaar</label>
                <input type="number" value={jaar} onChange={e=>setJaar(Number(e.target.value))}
                      className="border rounded px-2 py-1 w-full"/>
              </div>
              <div>
                <label className="block text-sm mb-1">Groei (×)</label>
                <input type="number" step="0.01" value={groei} onChange={e=>setGroei(Number(e.target.value))}
                      className="border rounded px-2 py-1 w-full"/>
              </div>
              <div>
                <label className="block text-sm mb-1">Norm € / med / kw</label>
                <input type="number" value={norm} onChange={e=>setNorm(Number(e.target.value))}
                      className="border rounded px-2 py-1 w-full"/>
              </div>
              <div>
                <label className="block text-sm mb-1">Kosten € / med / kw</label>
                <input type="number" step="0.01" value={costPerQ} onChange={e=>setCostPerQ(Number(e.target.value))}
                      className="border rounded px-2 py-1 w-full"/>
              </div>
              <div>
                <label className="block text-sm mb-1">Items / med / kw</label>
                <input type="number" value={itemsPerQ} onChange={e=>setItemsPerQ(Number(e.target.value))}
                      className="border rounded px-2 py-1 w-full" />
              </div>
            </div>
          </>
        )}
      </div>

      {isLoading && <p>Bezig met laden…</p>}
      {error && <p className="text-red-600 text-sm whitespace-pre-wrap">Fout: {String(error.message || error)}</p>}

      {data?.ok && Array.isArray(data?.weekdays) && (
        <div className="space-y-10">
          {data.weekdays.map((wd: any) => {
            const vals = wd.slots.map((s: any) => Number(s.omzet_avg || 0));
            const min = Math.min(...vals);
            const max = Math.max(...vals);
            const grouped = groupByHour(wd.slots);

            return (
              <div key={wd.isodow} className="border rounded-lg p-4 shadow">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">
                    {wd.naam} <span className="text-sm text-gray-600">({wd.open} – {wd.close})</span>
                  </h2>
                  <div className="hidden sm:flex items-center gap-2 text-xs text-gray-600">
                    <span>laag</span>
                    <div className="h-3 w-16 rounded" style={{ background: "hsl(210 70% 92%)" }} />
                    <div className="h-3 w-16 rounded" style={{ background: "hsl(210 70% 72%)" }} />
                    <div className="h-3 w-16 rounded" style={{ background: "hsl(210 70% 52%)" }} />
                    <span>hoog</span>
                  </div>
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
                            const { bg, fg } = heatColor(Number(s.omzet_avg || 0), min, max);
                            return (
                              <td key={idx} className="w-1/4">
                                <div
                                  className="rounded-md px-3 py-2 flex flex-col gap-1 shadow-sm border"
                                  style={{ background: bg, color: fg, borderColor: "rgba(0,0,0,0.06)" }}
                                  title={
                                    !showStaff
                                      ? `${s.from_to} • ${fmtEUR0(Number(s.omzet_avg || 0))}`
                                      : `${s.from_to} • ${fmtEUR0(Number(s.omzet_avg || 0))} • Budget ${fmtEUR2(Number(s.budget_eur||0))}`
                                  }
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-xs sm:text-[13px]">{s.from_to}</span>
                                    <span className="font-semibold">{fmtEUR0(Number(s.omzet_avg || 0))}</span>
                                  </div>
                                  {showStaff && (
                                    <div className="flex items-center justify-between text-xs opacity-90">
                                      <span>
                                        N {s.staff_norm ?? 0}
                                        { (s.staff_capacity ?? 0) > 0 && ` | Cap ${s.staff_capacity}` }
                                      </span>
                                      <span>
                                        Bud {s.staff_budget_cap ?? 0} ➜ Plan <strong>{s.staff_plan ?? 0}</strong>
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
