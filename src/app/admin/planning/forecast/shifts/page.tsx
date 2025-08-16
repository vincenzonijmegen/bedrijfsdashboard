// src/app/admin/planning/forecast/page.tsx
"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ForecastPlanningPage() {
  const today = new Date().toISOString().slice(0,10);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [norm, setNorm] = useState(100);
  const [costPerQ, setCostPerQ] = useState(3.75);
  const [standbyLate, setStandbyLate] = useState(1);
  const [keukenBasis, setKeukenBasis] = useState(0);

  const query = `/api/rapportage/prognose/shifts?jaar=${new Date().getFullYear()}&start=${start}&einde=${end}&norm=${norm}&cost_per_q=${costPerQ}&standby_late=${standbyLate}&keuken_basis=${keukenBasis}`;
  const { data, error, isLoading } = useSWR(query, fetcher);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Forecast Planning</h1>

      {/* Instellingen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm">Startdatum</label>
          <input type="date" value={start} onChange={e => setStart(e.target.value)} className="border rounded px-2 py-1 w-full"/>
        </div>
        <div>
          <label className="block text-sm">Einddatum</label>
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="border rounded px-2 py-1 w-full"/>
        </div>
        <div>
          <label className="block text-sm">Norm €/medewerker/kwartier</label>
          <input type="number" value={norm} onChange={e => setNorm(Number(e.target.value))} className="border rounded px-2 py-1 w-full"/>
        </div>
        <div>
          <label className="block text-sm">Kosten/kwartier (€)</label>
          <input type="number" step="0.01" value={costPerQ} onChange={e => setCostPerQ(Number(e.target.value))} className="border rounded px-2 py-1 w-full"/>
        </div>
        <div>
          <label className="block text-sm">Standby late</label>
          <select value={standbyLate} onChange={e => setStandbyLate(Number(e.target.value))} className="border rounded px-2 py-1 w-full">
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </div>
        <div>
          <label className="block text-sm">Keukenbasis</label>
<select value={keukenBasis} onChange={e => setKeukenBasis(Number(e.target.value))}>
  <option value="0">Nee</option>
  <option value="1">Ja</option>
</select>

        </div>
      </div>

      {/* Status */}
      {isLoading && <p>Bezig met laden...</p>}
      {error && <p className="text-red-600">Error: {error.message}</p>}

      {/* Resultaten */}
      {data?.ok && data.days && (
        <div className="space-y-8">
          {data.days.map((day: any) => (
            <div key={day.date} className="border rounded-lg p-4 shadow">
              <h2 className="text-lg font-semibold mb-2">{day.date} (open {day.open} – {day.clean_done})</h2>
              
              {/* Chart (vereenvoudigd, alleen aantal shifts per kwartier vs forecast omzet) */}
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={day.shifts.map((s:any) => ({ start: s.start, count: s.count }))}>
                  <CartesianGrid strokeDasharray="3 3"/>
                  <XAxis dataKey="start"/>
                  <YAxis/>
                  <Tooltip/>
                  <Line type="monotone" dataKey="count" stroke="#8884d8"/>
                </LineChart>
              </ResponsiveContainer>

              {/* Shifts overzicht */}
              <table className="w-full text-sm mt-4 border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-2 py-1">Rol</th>
                    <th className="border px-2 py-1">Start</th>
                    <th className="border px-2 py-1">Eind</th>
                    <th className="border px-2 py-1">Aantal</th>
                  </tr>
                </thead>
                <tbody>
                  {day.shifts.map((s:any, idx:number) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
