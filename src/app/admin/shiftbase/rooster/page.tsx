// src/app/admin/shiftbase/rooster/page.tsx

"use client";

import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Dagrooster() {
  // Datum selecteren
  const today = new Date();
  const formatISO = (date: Date) => date.toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(formatISO(today));

  // Vertaal ISO naar Nederlandse datum met weekdag
  const formatDutchDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('nl-NL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  // Fetch rooster en timesheets
  const { data: rosterData, error: rosterError } = useSWR(
    `/api/shiftbase/rooster?date=${selectedDate}`,
    fetcher
  );
  const { data: timesheetData, error: timesheetError } = useSWR(
    `/api/shiftbase/timesheets?date=${selectedDate}`,
    fetcher
  );

  if (rosterError || timesheetError) return <p>Fout bij laden data.</p>;
  if (!rosterData || !timesheetData) return <p>Gegevens worden geladen...</p>;

  // Navigatie knoppen
  const prevDay = () =>
    setSelectedDate(
      formatISO(
        new Date(new Date(selectedDate).setDate(new Date(selectedDate).getDate() - 1))
      )
    );
  const nextDay = () =>
    setSelectedDate(
      formatISO(
        new Date(new Date(selectedDate).setDate(new Date(selectedDate).getDate() + 1))
      )
    );
  const goToday = () => setSelectedDate(formatISO(today));

  // Groeperen op korte shiftnaam
  const perShift = rosterData.data.reduce((acc: any, item: any) => {
    const shiftKey = item.Roster.name || "Onbekende shift";
    if (!acc[shiftKey]) acc[shiftKey] = [];
    acc[shiftKey].push(item);
    return acc;
  }, {});

  const gewensteVolgorde = [
    "S1K","S1KV","S1","S1Z","S1L","S1S",
    "S2K","S2","S2L","S2S",
    "SPS","SLW1","SLW2"
  ];

  const gesorteerdeEntries = gewensteVolgorde
    .filter((naam) => perShift[naam])
    .map((naam) => [naam, perShift[naam]] as [string, any[]]);

  return (
    <div className="p-4">
      {/* Header en datum */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Dagrooster</h1>
          <p className="font-bold">{formatDutchDate(selectedDate)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={prevDay} className="px-2 py-1 bg-gray-200 rounded">←</button>
          <button onClick={goToday} className="px-2 py-1 bg-gray-200 rounded">Vandaag</button>
          <button onClick={nextDay} className="px-2 py-1 bg-gray-200 rounded">→</button>
        </div>
      </div>

      {/* Shifts en tijden */}
      {gesorteerdeEntries.map(([shiftKey, items]) => {
        const kleur = items[0].Roster.color || '#333';
        const langeNaam = items[0].Shift?.long_name || shiftKey;

        return (
          <div key={shiftKey} className="mb-3">
            <h2
              className="text-lg font-semibold mb-1"
              style={{ backgroundColor: kleur, color: 'white', padding: '4px 8px', borderRadius: '6px' }}
            >
              {langeNaam}
            </h2>
            <ul className="space-y-0.5">
              {items.map((i: any) => {
                // Zoek timesheet entry op gebruiker
                const tsWrapper = timesheetData.data.find(
                  (t: any) =>
                    t.Timesheet.user_id === i.Roster.user_id &&
                    t.Timesheet.date === selectedDate
                );
                const ts = tsWrapper?.Timesheet;
                // Haal clocked_in en clocked_out tijden
                const klokIn = ts?.clocked_in?.split(' ')[1].slice(0,5) || '-';
                const klokUit = ts?.clocked_out?.split(' ')[1].slice(0,5) || '-';

                return (
                  <li key={i.Roster.id} className="pl-2 flex justify-between">
                    <span>
                      <span className="font-semibold">
                        {i.Roster.starttime.slice(0,5)}–{i.Roster.endtime.slice(0,5)}
                      </span>{' '}
                      <strong>{i.User?.name || 'Onbekend'}</strong>
                    </span>
                    <span className="text-sm">
                      In: {klokIn} Uit: {klokUit}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
