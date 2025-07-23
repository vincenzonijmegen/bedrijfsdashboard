// ===========================
// File: src/app/admin/shiftbase/rooster/page.tsx
// ===========================
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface TimesheetEntry {
  Timesheet: {
    user_id: string;
    date: string;
    clocked_in: string | null;
    clocked_out: string | null;
  };
}

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

  useEffect(() => {
    console.log("[DEBUG] Geselecteerde datum gewijzigd:", selectedDate);
  }, [selectedDate]);

  const { data, error } = useSWR<ShiftItem[]>(
    () => `/api/shiftbase/rooster?datum=${selectedDate}`,
    fetcher
  );

  const { data: timesheetData } = useSWR<TimesheetEntry[]>(
    selectedDate === formatISO(today) ? `/api/shiftbase/timesheets?date=${selectedDate}&includeApproved=true` : null,
    fetcher
  );

  const rosterData = data || [];

  const changeDay = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(formatISO(d));
  };

  if (error) return <p className="p-4 text-red-600">Fout: {error.message}</p>;
  if (!data) return <p className="p-4">Laden…</p>;

  const perShift = rosterData.reduce((acc: Record<string, ShiftItem[]>, item) => {
    const key = item.Roster.name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const gewensteVolgorde = [
    "S1K", "S1KV", "S1", "S1Z", "S1L", "S1S",
    "S2K", "S2", "S2L", "S2S",
    "SPS", "SLW1", "SLW2"
  ];
  const order = gewensteVolgorde.filter(naam => perShift[naam])
    .concat(Object.keys(perShift).filter(naam => !gewensteVolgorde.includes(naam)));

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
          min="2024-01-01"
          max="2026-12-31"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="border px-2 py-1 rounded"
        />
        <button onClick={() => changeDay(1)} className="px-2 py-1 bg-gray-200 rounded">→</button>
      </div>

      <h1 className="text-xl font-bold mb-2">Rooster voor {new Date(selectedDate).toLocaleDateString('nl-NL', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</h1>

      {order.length === 0 ? (
        <p>Geen shifts gevonden voor deze dag.</p>
      ) : (
        order.map(shiftName => (
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
                    <strong>{item.User?.name || 'Onbekend'}</strong>{selectedDate === formatISO(today) && (() => {
                      const entry = Array.isArray(timesheetData)
                      ? timesheetData.find(t => t.Timesheet.user_id === item.id)
                      : undefined;

                      const inTijd = entry?.Timesheet.clocked_in?.split(' ')[1]?.slice(0,5) || '--';
                      const uitTijd = entry?.Timesheet.clocked_out?.split(' ')[1]?.slice(0,5) || '--';
                      const klasse = entry ? (entry.Timesheet.clocked_in && entry.Timesheet.clocked_out ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800') : 'bg-red-100 text-red-800';
                      return <span className={`ml-2 px-1 rounded text-sm ${klasse}`}>⏱ In: {inTijd} Uit: {uitTijd}</span>;
                    })()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
