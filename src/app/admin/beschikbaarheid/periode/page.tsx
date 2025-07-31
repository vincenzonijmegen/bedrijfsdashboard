// src/app/admin/beschikbaarheid/periode/page.tsx
"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";

interface Regel {
  id: number;
  medewerker_id: number;
  naam: string;
  startdatum: string;
  einddatum: string;
  max_shifts_per_week: number;
  opmerkingen?: string;
  [key: string]: any;
}

const dagen = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];
// Softer background colors per day
const kleuren = [
  "bg-blue-50",
  "bg-green-50",
  "bg-yellow-50",
  "bg-red-50",
  "bg-purple-50",
  "bg-pink-50",
  "bg-teal-50",
];

export default function BeschikbaarheidPeriode() {
  const today = new Date();
  const formatISO = (d: Date) => d.toISOString().split('T')[0];
  const [start, setStart] = useState(formatISO(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [end, setEnd] = useState(formatISO(new Date(today.getFullYear(), today.getMonth() + 1, 0)));

  const { data, error } = useSWR<Regel[]>('/api/beschikbaarheid', url => fetch(url).then(r => r.json()));

  const filtered = useMemo(() => {
    if (!data) return [];
    const s = new Date(start);
    const e = new Date(end);
    return data.filter(regel => {
      const rs = new Date(regel.startdatum);
      const re = new Date(regel.einddatum);
      return !(re < s || rs > e);
    });
  }, [data, start, end]);

  if (error) return <div className="p-4 text-red-600">Fout bij laden</div>;
  if (!data) return <div className="p-4">Laden…</div>;

  return (
    <div className="p-4 overflow-auto">
      <h1 className="text-2xl font-bold mb-4">Beschikbaarheid per periode</h1>
      <div className="flex gap-4 mb-6">
        <div>
          <label className="block mb-1">Startdatum</label>
          <input
            type="date"
            value={start}
            onChange={e => setStart(e.target.value)}
            className="border px-3 py-2 rounded"
          />
        </div>
        <div>
          <label className="block mb-1">Einddatum</label>
          <input
            type="date"
            value={end}
            onChange={e => setEnd(e.target.value)}
            className="border px-3 py-2 rounded"
          />
        </div>
      </div>
      <table className="w-full border-collapse border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1 text-left">Naam</th>
            <th className="border px-2 py-1 text-left">Periode</th>
            {dagen.map((dag, idx) => (
              <React.Fragment key={dag}>
                <th className={`border px-2 py-1 text-center ${kleuren[idx]}`}>{dag.charAt(0)}1</th>
                <th className={`border px-2 py-1 text-center ${kleuren[idx]}`}>{dag.charAt(0)}2</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map(regel => (
            <tr key={regel.id}>
              <td className="border px-2 py-1 truncate max-w-[100px]" title={regel.naam}>{regel.naam}</td>
              <td className="border px-2 py-1 whitespace-nowrap">
                {new Date(regel.startdatum).toLocaleDateString("nl-NL")} –{' '}
                {new Date(regel.einddatum).toLocaleDateString("nl-NL")}
              </td>
              {dagen.map((dag, idx) => (
                <React.Fragment key={`${regel.id}-${dag}`}> 
                  <td className={`border px-2 py-1 text-center ${kleuren[idx]}`}>{regel[`${dag}_1`] ? "✓" : ""}</td>
                  <td className={`border px-2 py-1 text-center ${kleuren[idx]}`}>{regel[`${dag}_2`] ? "✓" : ""}</td>
                </React.Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
