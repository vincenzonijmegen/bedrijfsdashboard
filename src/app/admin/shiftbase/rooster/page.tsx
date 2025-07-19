// src/app/admin/shiftbase/rooster/page.tsx

"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DagroosterVandaag() {
  const { data, error } = useSWR('/api/shiftbase/rooster', fetcher);

  if (error) return <p>Fout bij laden van rooster.</p>;
  if (!data) return <p>Rooster wordt geladen...</p>;

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
      <h1 className="text-xl font-bold mb-4">Dagrooster vandaag</h1>
      {gesorteerdeEntries.map(([shiftNaam, items]) => {
        const kleur = items[0].Roster.color || '#333';
        // gebruik lange naam uit Shift.long_name
        const langeNaam = items[0].Shift?.long_name || '';

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
              {shiftNaam} {langeNaam && `- ${langeNaam}`}
            </h2>
            <ul className="space-y-1">
              {items.map((i: any) => (
                <li key={i.Roster.id} className="pl-2">
                  {i.Roster.starttime.slice(0,5)}–{i.Roster.endtime.slice(0,5)} {i.User?.name || 'Onbekend'}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
