// app/shift-acties/page.tsx
"use client";

import useSWR from "swr";

interface Actie {
  id: number;
  datum: string;
  shift: string;
  tijd: string;
  van: string;
  naar: string;
  type: string;
  bron_email: string;
}

export default function ShiftActiesPage() {
  const { data, error } = useSWR<Actie[]>("/api/shift-acties", (url: string) =>
    fetch(url).then((res) => res.json())
  );

  if (error) return <p>Fout bij laden</p>;
  if (!data) return <p>Laden...</p>;

  const opgepakt: Record<string, number> = {};
  const geruild: Record<string, number> = {};
  const overgenomen: Record<string, number> = {};

  data.forEach((item) => {
    if (item.type === "Open dienst opgepakt") {
      opgepakt[item.naar] = (opgepakt[item.naar] || 0) + 1;
    }
    if (item.type === "Ruil geaccepteerd") {
      geruild[item.naar] = (geruild[item.naar] || 0) + 1;
      overgenomen[item.van] = (overgenomen[item.van] || 0) + 1;
    }
  });

  const renderStatsTable = (title: string, dataset: Record<string, number>) => {
    const sorted = Object.entries(dataset).sort((a, b) => b[1] - a[1]);
    return (
      <div className="mb-6">
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <ul className="list-disc list-inside">
          {sorted.map(([naam, count]) => (
            <li key={naam}>
              <strong>{naam}</strong>: {count}×
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">📊 Shiftacties & Statistieken</h1>

      <table className="w-full text-sm border mb-10">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 border">Datum</th>
            <th className="p-2 border">Shift</th>
            <th className="p-2 border">Tijd</th>
            <th className="p-2 border">Van</th>
            <th className="p-2 border">Naar</th>
            <th className="p-2 border">Type</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id} className="odd:bg-white even:bg-gray-50">
              <td className="p-2 border">{item.datum}</td>
              <td className="p-2 border">{item.shift}</td>
              <td className="p-2 border">{item.tijd}</td>
              <td className="p-2 border">{item.van}</td>
              <td className="p-2 border">{item.naar}</td>
              <td className="p-2 border">{item.type}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {renderStatsTable("Open diensten opgepakt", opgepakt)}
      {renderStatsTable("Shift overgenomen door", geruild)}
      {renderStatsTable("Shift afgestaan door", overgenomen)}
    </div>
  );
}
