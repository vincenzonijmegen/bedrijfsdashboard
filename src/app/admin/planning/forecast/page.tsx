// src/app/admin/planning/forecast/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const ct = res.headers.get("content-type") || "";
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${body.slice(0, 300)}`);
  if (!ct.includes("application/json")) throw new Error(`Non-JSON response: ${ct}`);
  return JSON.parse(body);
};

const maandNamen = [
  "", "januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"
];

const fmtEUR = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

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
      <h1 className="text-2xl font-bold">Gemiddelde omzet – {maandNamen[maand]}</h1>

      {/* Maand selectie */}
      <div className="w-full max-w-sm">
        <label className="block text-sm mb-1">Maand</label>
        <select
          value={maand}
          onChange={(e) => setMaand(Number(e.target.value))}
          className="border rounded px-2 py-1 w-full"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{maandNamen[m]}</option>
          ))}
        </select>
      </div>

      {isLoading && <p>Bezig met laden…</p>}
      {error && <p className="text-red-600 text-sm whitespace-pre-wrap">Fout: {String(error.message || error)}</p>}

      {/* Overzicht per weekdag */}
      {data?.ok && Array.isArray(data?.weekdays) && (
        <div className="space-y-10">
          {data.weekdays.map((wd: any) => (
            <div key={wd.isodow} className="border rounded-lg p-4 shadow">
              <h2 className="text-lg font-semibold mb-2">
                {wd.naam} <span className="text-sm text-gray-600">({wd.open} – {wd.close})</span>
              </h2>

              {/* Lijst van tijdvakken */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {wd.slots.map((s: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between border rounded px-3 py-2"
                  >
                    <span className="font-mono">{s.from_to}</span>
                    <span className="tabular-nums">{fmtEUR(s.omzet_avg)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
