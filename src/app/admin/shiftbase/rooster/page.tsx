// ===========================
// File: src/app/admin/shiftbase/rooster/page.tsx
// ===========================
"use client";
import { useState } from "react";
import useSWR from "swr";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
};

export default function RoosterPage() {
  const today = new Date();
  const formatISO = (d: Date) => d.toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(formatISO(today));

  const { data: rosterData, error: rosterError } = useSWR(
    `/api/shiftbase/rooster?datum=${selectedDate}`,
    fetcher
  );

  if (rosterError) return <p>Fout: {rosterError.message}</p>;
  if (!rosterData) return <p>Rooster laden...</p>;

  const changeDay = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(formatISO(d));
  };

  return (
    <div className="p-4">
      <div className="flex items-center mb-4">
        <button onClick={() => changeDay(-1)} className="px-2 py-1 bg-gray-200 rounded">←</button>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="mx-2 border px-2 py-1"
        />
        <button onClick={() => changeDay(1)} className="px-2 py-1 bg-gray-200 rounded">→</button>
      </div>

      <h2 className="text-lg font-semibold mb-2">Rooster voor {selectedDate}</h2>
      <ul>
        {Array.isArray(rosterData) && rosterData.map((shift: any) => (
          <li key={shift.id} className="mb-1">
            {shift.Roster.starttime.slice(0,5)} - {shift.Roster.endtime.slice(0,5)}: {shift.User?.name || 'Onbekend'}
          </li>
        ))}
      </ul>
    </div>
  );
}
