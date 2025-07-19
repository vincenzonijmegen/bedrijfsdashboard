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

  const formatDutchDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const { data, error } = useSWR(
    `/api/shiftbase/rooster?date=${selectedDate}`,
    fetcher
  );

  if (error) return <p>Fout bij laden van rooster.</p>;
  if (!data) return <p>Rooster wordt geladen...</p>;

  // Navigatie knoppen
  const prevDay = () => setSelectedDate(formatISO(new Date(new Date(selectedDate).setDate(new Date(selectedDate).getDate() - 1))));
  const nextDay = () => setSelectedDate(formatISO(new Date(new Date(selectedDate).setDate(new Date(selectedDate).getDate() + 1))));
  const goToday = () => setSelectedDate(formatISO(today));

  // Groepeer op korte shiftnaam
  const perShift = data.data.reduce((acc: any, item: any) => {
    const shift = item.Roster.name || "Onbekende shift";
    if (!acc[shift]) acc[shift] = [];
    acc[shift].push(item);
    return acc;
  }, {});

  const gewensteVolgorde = [
    "S1K", "S1KV", "S1", "S1Z", "S1L", "S1S",
    "S2K", "S2", "S2L", "S2S",
    "SPS", "SLW1", "SLW2"
  ];

  // Sorteer en filter op gewenste volgorde
  const gesorteerdeEntries = gewensteVolgorde
    .filter((naam) => perShift[naam])
    .map((naam) => [naam, perShift[naam]] as [string, any[]]);

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Dagrooster</h1>
        <div className="flex gap-2">
          <button onClick={prevDay} className="px-2 py-1 bg-gray-200 rounded">&larr;</button>
          <button onClick={goToday} className="px-2 py-1 bg-gray-200 rounded">Vandaag</button>
          <button onClick={nextDay} className="px-2 py-1 bg-gray-200 rounded">&rarr;</button>
        </div>
      </div>
      <p className="mb-4">{formatDutchDate(selectedDate)}</p>

      {gesorteerdeEntries.map(([shiftNaam, items]) => {
        const kleur = items[0].Roster.color || '#333';
        const langeNaam = items[0].Shift?.long_name || '';
        const startTijden = items.map((i) => i.Roster.starttime).sort();
        const eindTijden = items.map((i) => i.Roster.endtime).sort();

        return (
          <div key={shiftNaam} className="mb-6">
            <h2
              className="text-lg font-semibold mb-2"
              style={{
                backgroundColor: kleur,
                color: 'white',
                padding: '4px 8px',
                borderRadius: '6px'
              }}
            >
              {langeNaam}
            </h2>
            <ul className="space-y-1">
              {items.map((i: any) => (
                <li key={i.Roster.id} className="pl-2">
                  {i.Roster.starttime.slice(0,5)}–{i.Roster.endtime.slice(0,5)} <strong>{i.User?.name || 'Onbekend'}</strong>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
