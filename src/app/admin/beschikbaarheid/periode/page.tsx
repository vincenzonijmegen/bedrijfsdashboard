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

// Background colors per day of week
const dagen = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];
const kleuren = [
  "bg-blue-50",
  "bg-green-50",
  "bg-yellow-50",
  "bg-red-50",
  "bg-purple-50",
  "bg-pink-50",
  "bg-teal-50",
];

export default function BeschikbaarheidWeek() {
  const today = new Date();
  const getISOWeek = (d: Date) => {
    const date = new Date(d.getTime());
    date.setHours(0,0,0,0);
    // Thursday in current week decides the year.
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const week1 = new Date(date.getFullYear(),0,4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay()+6)%7)) / 7);
  };
  const [jaar, setJaar] = useState(today.getFullYear());
  const [week, setWeek] = useState(getISOWeek(today));

  // Compute Monday of ISO week
  const weekStart = useMemo(() => {
    const simple = new Date(jaar,0,1 + (week - 1) * 7);
    const dow = simple.getDay(); // 0 Sunday
    const isoDow = (dow + 6) % 7; // Mon=0
    simple.setDate(simple.getDate() - isoDow);
    return simple;
  }, [jaar, week]);
  const weekDates = useMemo(() => {
    const arr: Date[] = [];
    for (let i=0; i<7; i++) arr.push(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+i));
    return arr;
  }, [weekStart]);

  const { data, error } = useSWR<Regel[]>(
    "/api/beschikbaarheid",
    (url: string) => fetch(url).then(r => r.json())
  );

  // Filter relevant regels and group per medewerker
  const perMedewerker = useMemo(() => {
    if (!data) return {} as Record<number, Regel[]>;
    const map: Record<number, Regel[]> = {};
    data.forEach(regel => {
      const rs = new Date(regel.startdatum);
      const re = new Date(regel.einddatum);
      // if overlaps week
      if (!(re < weekStart || rs > new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+6))) {
        (map[regel.medewerker_id] ||= []).push(regel);
      }
    });
    Object.values(map).forEach(arr =>
      arr.sort((a,b) => new Date(a.startdatum).getTime() - new Date(b.startdatum).getTime())
    );
    return map;
  }, [data, weekStart]);

  if (error) return <div className="p-4 text-red-600">Fout bij laden</div>;
  if (!data) return <div className="p-4">Laden…</div>;

  return (
    <div className="p-4 overflow-auto">
      <h1 className="text-2xl font-bold mb-4">Beschikbaarheid per week</h1>
      <div className="flex gap-4 mb-6">
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
        <div>
          <label className="block mb-1">Week</label>
          <input
            type="number"
            value={week}
            onChange={e => setWeek(Number(e.target.value))}
            className="border px-3 py-2 rounded w-24"
            min={1} max={53}
          />
        </div>
        <div className="self-end text-sm">
          {`Periode: ${weekStart.toLocaleDateString('nl-NL')} t/m ${new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+6).toLocaleDateString('nl-NL')}`}
        </div>
      </div>
      <table className="w-full border-collapse border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1 text-left">Naam</th>
            {weekDates.map((d, idx) => (
              <React.Fragment key={d.toISOString()}>
                <th className={`border px-1 py-1 text-center ${kleuren[idx]}`}>{d.getDate()} s1</th>
                <th className={`border px-1 py-1 text-center ${kleuren[idx]}`}>{d.getDate()} s2</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(perMedewerker).map(([, regels]) => {
            const naam = regels[0].naam;
            return (
              <tr key={regels[0].medewerker_id}>
                <td className="border px-2 py-1 truncate max-w-[100px]" title={naam}>{naam}</td>
                {weekDates.map((d, idx) => {
                  const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
                  const aktRegel = [...regels].reverse().find(r => {
                    const rs = new Date(r.startdatum);
                    const re = new Date(r.einddatum);
                    return rs <= d && re >= d;
                  });
                  const a1 = aktRegel ? aktRegel[`${dagen[dayIdx]}_1`] : false;
                  const a2 = aktRegel ? aktRegel[`${dagen[dayIdx]}_2`] : false;
                  return (
                    <React.Fragment key={d.toISOString()}>
                      <td className={`border px-1 py-1 text-center ${kleuren[dayIdx]}`}>{a1 ? "✓" : ""}</td>
                      <td className={`border px-1 py-1 text-center ${kleuren[dayIdx]}`}>{a2 ? "✓" : ""}</td>
                    </React.Fragment>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
