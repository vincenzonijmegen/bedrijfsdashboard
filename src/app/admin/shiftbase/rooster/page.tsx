// src/app/admin/shiftbase/rooster/page.tsx

"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DagroosterVandaag() {
  const { data, error } = useSWR('/api/shiftbase/rooster', fetcher);

  if (error) return <p>Fout bij laden van rooster.</p>;
  if (!data) return <p>Rooster wordt geladen...</p>;

  // Groepeer op shiftnaam (bijv. "S1", "S2K", etc.)
  const perShift = data.data.reduce((acc: any, item: any) => {
    const shift = item.Roster.name || "Onbekende shift";
    if (!acc[shift]) acc[shift] = [];
    acc[shift].push(item);
    return acc;
  }, {});

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Dagrooster vandaag</h1>
      {Object.entries(perShift).map(([shiftNaam, items]) => (
        <div key={shiftNaam} className="mb-6">
          {(() => {
            const startTijden = items.map(i => i.Roster.starttime).sort();
            const eindTijden = items.map(i => i.Roster.endtime).sort();
            const kleur = items[0].Roster.color || '#333';
            return (
              <h2
                className="text-lg font-semibold mb-2"
                style={{
                  backgroundColor: kleur,
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '6px'
                }}
              >
                {shiftNaam} ({startTijden[0]}–{eindTijden[eindTijden.length - 1]})
              </h2>
            );
          })()}
          <ul className="space-y-1">
            {items.map((i: any) => (
              <li key={i.Roster.id} className="pl-2">{i.User?.name || 'Onbekend'}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
