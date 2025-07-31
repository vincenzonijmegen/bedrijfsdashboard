// src/app/admin/beschikbaarheid/page.tsx
"use client";

import useSWR from "swr";

interface Regel {
  id: number;
  medewerker_id: number;
  naam: string;
  startdatum: string;
  einddatum: string;
  max_shifts_per_week: number;
  bron: string;
  opmerkingen?: string;
  [key: string]: any;
}

const dagen = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];

export default function BeschikbaarheidOverzicht() {
  const { data, error } = useSWR<Regel[]>("/api/beschikbaarheid", (url: string) => fetch(url).then((res) => res.json()));

  if (error) return <div className="p-4 text-red-600">Fout bij laden</div>;
  if (!data) return <div className="p-4">Laden…</div>;

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Beschikbaarheid per medewerker</h1>
      <table className="w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1 text-left">Naam</th>
            <th className="border px-2 py-1 text-left">Periode</th>
            <th className="border px-2 py-1 text-left">Max/wk</th>
            <th className="border px-2 py-1 text-left">Shifts</th>
            <th className="border px-2 py-1 text-left">Bron</th>
            <th className="border px-2 py-1 text-left">Opmerking</th>
          </tr>
        </thead>
        <tbody>
          {data.map((regel) => (
            <tr key={regel.id}>
              <td className="border px-2 py-1">{regel.naam}</td>
              <td className="border px-2 py-1">{new Date(regel.startdatum).toLocaleDateString("nl-NL")} t/m {new Date(regel.einddatum).toLocaleDateString("nl-NL")}</td>
              <td className="border px-2 py-1">{regel.max_shifts_per_week}</td>
              <td className="border px-2 py-1">
                {dagen.map((dag) => {
                  const s1 = regel[`${dag}_1`];
                  const s2 = regel[`${dag}_2`];
                  if (!s1 && !s2) return null;
                  return (
                    <div key={dag}>
                      {dag.slice(0,2)}: {s1 ? "1" : ""}{s1 && s2 ? "+" : ""}{s2 ? "2" : ""}
                    </div>
                  );
                })}
              </td>
              <td className="border px-2 py-1">{regel.bron}</td>
              <td className="border px-2 py-1">{regel.opmerkingen || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
