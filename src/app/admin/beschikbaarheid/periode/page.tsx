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

// Softer background colors per day of week
const dagen = ["maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag","zondag"];
const kleuren = [
  "bg-blue-50",
  "bg-green-50",
  "bg-yellow-50",
  "bg-red-50",
  "bg-purple-50",
  "bg-pink-50",
  "bg-teal-50",
];

const maandNamen = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December"
];

export default function BeschikbaarheidPeriode() {
  const today = new Date();
  const [jaar, setJaar] = useState(today.getFullYear());
  const [maand, setMaand] = useState(today.getMonth());

  const { data, error } = useSWR<Regel[]>(
    "/api/beschikbaarheid",
    (url: string) => fetch(url).then(res => res.json())
  );

  // Compute start and end dates of selected month
  const startDatum = useMemo(() => new Date(jaar, maand, 1), [jaar, maand]);
  const eindDatum = useMemo(() => new Date(jaar, maand + 1, 0), [jaar, maand]);

  // List of dates in period
  const dateList = useMemo(() => {
    const dates: Date[] = [];
    const d = new Date(startDatum);
    while (d <= eindDatum) {
      dates.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }, [startDatum, eindDatum]);

  // Filter regels overlapping period
  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter(regel => {
      const rs = new Date(regel.startdatum);
      const re = new Date(regel.einddatum);
      return !(re < startDatum || rs > eindDatum);
    });
  }, [data, startDatum, eindDatum]);

  if (error) return <div className="p-4 text-red-600">Fout bij laden</div>;
  if (!data) return <div className="p-4">Laden…</div>;

  return (
    <div className="p-4 overflow-auto">
      <h1 className="text-2xl font-bold mb-4">Beschikbaarheid per periode</h1>
      <div className="flex gap-4 mb-6">
        <div>
          <label className="block mb-1">Maand</label>
          <select value={maand} onChange={e => setMaand(Number(e.target.value))} className="border px-3 py-2 rounded">
            {maandNamen.map((naam, idx) => (
              <option key={idx} value={idx}>{naam}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1">Jaar</label>
          <input
            type="number"
            value={jaar}
            onChange={e => setJaar(Number(e.target.value))}
            className="border px-3 py-2 rounded w-24"
            min={2000} max={2100}
          />
        </div>
      </div>
      <table className="w-full border-collapse border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1">Naam</th>
            {dateList.map(datum => (
              <React.Fragment key={datum.toISOString()}>
                <th className="border px-1 py-1 text-center whitespace-nowrap">
                  {datum.getDate()}s1
                </th>
                <th className="border px-1 py-1 text-center whitespace-nowrap">
                  {datum.getDate()}s2
                </th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map(regel => (
            <tr key={regel.id}>
              <td className="border px-2 py-1 truncate max-w-[100px]" title={regel.naam}>
                {regel.naam}
              </td>
              {dateList.map(datum => {
                const dayIdx = datum.getDay() === 0 ? 6 : datum.getDay() - 1; // maandag=0
                const available1 = regel[`${dagen[dayIdx]}_1`];
                const available2 = regel[`${dagen[dayIdx]}_2`];
                return (
                  <React.Fragment key={datum.toISOString()}>
                    <td className={`border px-1 py-1 text-center ${kleuren[dayIdx]}`}>{available1 ? "✓" : ""}</td>
                    <td className={`border px-1 py-1 text-center ${kleuren[dayIdx]}`}>{available2 ? "✓" : ""}</td>
                  </React.Fragment>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
