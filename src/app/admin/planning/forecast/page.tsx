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

const fmtEUR = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/** Heatmap-kleur o.b.v. waarde binnen (min..max) van dezelfde weekdag */
function heatColor(value: number, min: number, max: number) {
  if (!isFinite(value) || max <= min) {
    return { bg: "hsl(210 40% 94%)", fg: "#111" }; // neutraal licht
  }
  const t = Math.max(0, Math.min(1, (value - min) / (max - min))); // 0..1
  // HSL-blauw van licht (L=92%) naar donker (L=42%)
  const lightness = 92 - t * 50;
  const bg = `hsl(210 70% ${lightness}%)`;
  const fg = lightness < 55 ? "#fff" : "#111";
  return { bg, fg };
}

/** Groepeer kwartieren per uur (verwacht 4 kwartieren per uur) */
function groupByHour(slots: any[]) {
  const by: Record<number, any[]> = {};
  for (const s of slots) {
    (by[s.uur] ??= []).push(s);
  }
  const hours = Object.keys(by)
    .map((h) => Number(h))
    .sort((a, b) => a - b)
    .map((h) => {
      const q = by[h].slice().sort((a, b) => a.kwartier - b.kwartier);
      return { uur: h, slots: q };
    });
  return hours;
}

export default function ForecastPlanningPage() {
  const nu = new Date();
  const [maand, setMaand] = useState<number>(nu.getMonth() + 1);

  const query = useMemo(() => {
    const p = new URLSearchParams({ maand: String(maand) });
    return `/api/rapportage/profielen/overzicht?${p.toString()}`;
  }, [maand]);

  const { data, error, isLoading } = useSWR(query, fetcher);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Gemiddelde omzet – {maandNamen[maand]}</h1>
        <div className="w-full sm:w-60">
          <label className="block text-sm mb-1">Maand</label>
          <select
            value={maand}
            onChange={(e) => setMaand(Number(e.target.value))}
            className="border rounded px-2 py-1 w-full"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {maandNamen[m]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && <p>Bezig met laden…</p>}
      {error && (
        <p className="text-red-600 text-sm whitespace-pre-wrap">
          Fout: {String(error.message || error)}
        </p>
      )}

      {data?.ok && Array.isArray(data?.weekdays) && (
        <div className="space-y-10">
          {data.weekdays.map((wd: any) => {
            // min/max voor heatmap binnen deze weekdag
            const values = wd.slots.map((s: any) => Number(s.omzet_avg || 0));
            const min = Math.min(...values);
            const max = Math.max(...values);
            const grouped = groupByHour(wd.slots);

            return (
              <div key={wd.isodow} className="border rounded-lg p-4 shadow">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">
                    {wd.naam}{" "}
                    <span className="text-sm text-gray-600">
                      ({wd.open} – {wd.close})
                    </span>
                  </h2>
                  {/* Kleine legenda */}
                  <div className="hidden sm:flex items-center gap-2 text-xs text-gray-600">
                    <span>laag</span>
                    <div className="h-3 w-16 rounded" style={{ background: "hsl(210 70% 92%)" }} />
                    <div className="h-3 w-16 rounded" style={{ background: "hsl(210 70% 72%)" }} />
                    <div className="h-3 w-16 rounded" style={{ background: "hsl(210 70% 52%)" }} />
                    <span>hoog</span>
                  </div>
                </div>

                {/* Tabel: per uur één regel, vier kwartieren per rij */}
                <div className="overflow-x-auto">
                  <table className="min-w-[640px] w-full text-sm border-separate border-spacing-y-2">
                    <tbody>
                      {grouped.map((row) => (
                        <tr key={row.uur}>
                          {/* Uur-label links */}
                          <td className="align-middle pr-2 whitespace-nowrap text-gray-700 w-16 text-right font-medium">
                            {String(row.uur).padStart(2, "0")}:00
                          </td>

                          {/* Vier kwartiercellen */}
                          {row.slots.map((s: any, idx: number) => {
                            const { bg, fg } = heatColor(Number(s.omzet_avg || 0), min, max);
                            return (
                              <td key={idx} className="w-1/4">
                                <div
                                  className="rounded-md px-3 py-2 flex items-center justify-between shadow-sm border"
                                  style={{ background: bg, color: fg, borderColor: "rgba(0,0,0,0.06)" }}
                                  title={`${s.from_to} • ${fmtEUR(Number(s.omzet_avg || 0))}`}
                                >
                                  <span className="font-mono text-xs sm:text-[13px]">{s.from_to}</span>
                                  <span className="font-semibold">{fmtEUR(Number(s.omzet_avg || 0))}</span>
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
