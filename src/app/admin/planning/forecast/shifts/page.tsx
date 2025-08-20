// src/app/admin/planning/forecast/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const maandNamen = [
  "", // 0 placeholder
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

// ISO 1=maandag..7=zondag
const weekdagOpties = [
  { value: "ma", label: "maandag" },
  { value: "di", label: "dinsdag" },
  { value: "wo", label: "woensdag" },
  { value: "do", label: "donderdag" },
  { value: "vr", label: "vrijdag" },
  { value: "za", label: "zaterdag" },
  { value: "zo", label: "zondag" },
];

export default function ForecastPlanningPage() {
  const nu = new Date();
  const defaultMaand = nu.getMonth() + 1; // 1..12
  const isoDow = ((nu.getDay() + 6) % 7) + 1; // 1..7
  const defaultWeekdag = weekdagOpties[isoDow - 1]?.value ?? "za";

  const [jaar] = useState<number>(nu.getFullYear());
  const [maand, setMaand] = useState<number>(defaultMaand);
  const [weekdag, setWeekdag] = useState<string>(defaultWeekdag);

  const [norm, setNorm] = useState<number>(100); // € per medewerker per kwartier
  const [costPerQ, setCostPerQ] = useState<number>(3.75); // €15/u
  const [keukenBasis, setKeukenBasis] = useState<number>(0); // 0/1, telt mee in kosten
  const [standbyDayStart, setStandbyDayStart] = useState<string>("14:00"); // HH:MM
  const [standbyEveStart, setStandbyEveStart] = useState<string>("19:00"); // HH:MM

  const query = useMemo(() => {
    const p = new URLSearchParams({
      jaar: String(jaar),
      maand: String(maand),
      weekdag: weekdag, // 'ma','di',... of 1..7: route kan beide
      norm: String(norm),
      cost_per_q: String(costPerQ),
      keuken_basis: String(keukenBasis), // let op: exact "0" of "1"
      standby_day_start: standbyDayStart,
      standby_eve_start: standbyEveStart,
    });
    return `/api/rapportage/prognose/shifts?${p.toString()}`;
  }, [jaar, maand, weekdag, norm, costPerQ, keukenBasis, standbyDayStart, standbyEveStart]);

  const { data, error, isLoading } = useSWR(query, fetcher);

  // Chartdata voor month-weekday modus
  const chartData =
    data?.mode === "month-weekday" && Array.isArray(data?.quarters)
      ? data.quarters.map((q: any) => ({
          time: q.time,
          needed: q.need,
          planned: q.planned,
        }))
      : [];

  const titel = `Forecast – ${maandNamen[maand]} (${weekdagOpties.find((w) => w.value === weekdag)?.label || weekdag})`;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{titel}</h1>

      {/* Instellingen */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <div>
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

        <div>
          <label className="block text-sm mb-1">Weekdag</label>
          <select
            value={weekdag}
            onChange={(e) => setWeekdag(e.target.value)}
            className="border rounded px-2 py-1 w-full"
          >
            {weekdagOpties.map((wd) => (
              <option key={wd.value} value={wd.value}>
                {wd.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Norm €/medewerker/kwartier</label>
          <input
            type="number"
            value={norm}
            onChange={(e) => setNorm(Number(e.target.value))}
            className="border rounded px-2 py-1 w-full"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Kosten/kwartier (€)</label>
          <input
            type="number"
            step="0.01"
            value={costPerQ}
            onChange={(e) => setCostPerQ(Number(e.target.value))}
            className="border rounded px-2 py-1 w-full"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Keukenbasis (kostentelling)</label>
          <select
            value={keukenBasis}
            onChange={(e) => setKeukenBasis(Number(e.target.value))}
            className="border rounded px-2 py-1 w-full"
          >
            <option value={0}>Nee</option>
            <option value={1}>Ja</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Standby dag – start</label>
          <input
            type="time"
            step={900}
            value={standbyDayStart}
            onChange={(e) => setStandbyDayStart(e.target.value)}
            className="border rounded px-2 py-1 w-full"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Standby avond – start</label>
          <input
            type="time"
            step={900}
            value={standbyEveStart}
            onChange={(e) => setStandbyEveStart(e.target.value)}
            className="border rounded px-2 py-1 w-full"
          />
        </div>
      </div>

      {/* Status */}
      {isLoading && <p>Bezig met laden…</p>}
      {error && <p className="text-red-600">Error: {String(error)}</p>}

      {/* Mode: month-weekday */}
      {data?.mode === "month-weekday" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
            <div>
              <span className="font-medium">Open:</span> {data?.params?.coverage?.open} &nbsp;
              <span className="font-medium">Split:</span> {data?.params?.coverage?.split} &nbsp;
              <span className="font-medium">Sluit:</span> {data?.params?.coverage?.close} &nbsp;
              <span className="font-medium">Schoon klaar:</span> {data?.params?.coverage?.clean_done}
            </div>
          </div>

          {/* Chart: needed vs planned per kwartier */}
          <div className="border rounded-lg p-4 shadow">
            <h2 className="text-lg font-semibold mb-3">Behoefte vs Ingezet (per kwartier)</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="needed" name="Benodigd" stroke="#ef4444" dot={false} />
                <Line type="monotone" dataKey="planned" name="Ingezet" stroke="#3b82f6" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Shifts overzicht */}
          <div className="border rounded-lg p-4 shadow">
            <h2 className="text-lg font-semibold mb-3">Voorgestelde shifts (incl. standby)</h2>
            <table className="w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-2 py-1 text-left">Rol</th>
                  <th className="border px-2 py-1 text-left">Start</th>
                  <th className="border px-2 py-1 text-left">Eind</th>
                  <th className="border px-2 py-1 text-center">#</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(data?.shifts) &&
                  data.shifts.map((s: any, idx: number) => (
                    <tr key={idx}>
                      <td className="border px-2 py-1">{s.role}</td>
                      <td className="border px-2 py-1">{s.start}</td>
                      <td className="border px-2 py-1">{s.end}</td>
                      <td className="border px-2 py-1 text-center">{s.count}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Terugval: oude date-range render (alleen als je toch zo aanroept) */}
      {data?.mode === "date-range" && data?.days && (
        <div className="space-y-8">
          {data.days.map((day: any) => (
            <div key={day.date} className="border rounded-lg p-4 shadow">
              <h2 className="text-lg font-semibold mb-2">
                {day.date} (open {day.open} – {day.clean_done})
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border px-2 py-1">Rol</th>
                      <th className="border px-2 py-1">Start</th>
                      <th className="border px-2 py-1">Eind</th>
                      <th className="border px-2 py-1 text-center">#</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.shifts.map((s: any, idx: number) => (
                      <tr key={idx}>
                        <td className="border px-2 py-1">{s.role}</td>
                        <td className="border px-2 py-1">{s.start}</td>
                        <td className="border px-2 py-1">{s.end}</td>
                        <td className="border px-2 py-1 text-center">{s.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
