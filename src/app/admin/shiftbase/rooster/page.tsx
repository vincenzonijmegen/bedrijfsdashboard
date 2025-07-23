// ===========================
// File: src/app/admin/shiftbase/rooster/page.tsx
// ===========================
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(res => res.json());

type ShiftItem = {
  id: string;
  Roster: { starttime: string; endtime: string; name: string; color?: string; user_id: string };
  Shift?: { long_name: string };
  User?: { name: string };
};



export default function RoosterPage() {
  const today = new Date();
  const formatISO = (d: Date) => d.toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(formatISO(today));

  const { data: rosterData, error } = useSWR<ShiftItem[]>(
    `/api/shiftbase/rooster?datum=${selectedDate}`,
    fetcher
  );

  const rosterData = rosterData || [];  // direct array from API


  // Navigate days
  const changeDay = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(formatISO(d));
  };

  if (error) return <p className="p-4 text-red-600">Fout: {error.message}</p>;
  if (!rosterResponse) return <p className="p-4">Laden…</p>;

  // Group per Roster.name
  const perShift = rosterData.reduce((acc: Record<string, ShiftItem[]>, item) => {
    const key = item.Roster.name;
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});

  const order = Object.keys(perShift);

  return (
    <div className="p-4">
      <p className="mb-4">
        <Link href="/admin/rapportage" className="text-sm underline text-blue-600">
          ← Terug naar Rapportage
        </Link>
      </p>

      <div className="flex items-center mb-4 gap-2">
        <button onClick={() => changeDay(-1)} className="px-2 py-1 bg-gray-200 rounded">←</button>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="border px-2 py-1 rounded"
        />
        <button onClick={() => changeDay(1)} className="px-2 py-1 bg-gray-200 rounded">→</button>
      </div>

      <h1 className="text-xl font-bold mb-2">Rooster voor {selectedDate}</h1>

      {order.map(shiftName => (
        <div key={shiftName} className="mb-6">
          <h2
            className="text-lg font-semibold mb-1 px-2 rounded"
            style={{ backgroundColor: perShift[shiftName][0].Roster.color || '#334', color: 'white' }}
          >
            {perShift[shiftName][0].Shift?.long_name || shiftName}
          </h2>
          <ul className="pl-4 list-disc">
            {perShift[shiftName].map(item => (
              <li key={item.id} className="mb-1 flex justify-between">
                <span>
                  <span className="font-semibold">
                    {item.Roster.starttime.slice(0,5)}–{item.Roster.endtime.slice(0,5)}
                  </span>{' '}
                  <strong>{item.User?.name || 'Onbekend'}</strong>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
