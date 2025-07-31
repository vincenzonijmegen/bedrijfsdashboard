// src/app/admin/beschikbaarheid/page.tsx
"use client";

import React from "react";
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

const dagen = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];

export default function BeschikbaarheidOverzicht() {
  const { data, error, mutate } = useSWR<Regel[]>(
    "/api/beschikbaarheid",
    (url: string) => fetch(url).then((res) => res.json())
  );

  const handleDelete = async (id: number) => {
    if (!confirm("Weet je zeker dat je deze periode wilt verwijderen?")) return;
    await fetch(`/api/beschikbaarheid?id=${id}`, { method: "DELETE" });
    mutate();
  };

  if (error) return <div className="p-4 text-red-600">Fout bij laden</div>;
  if (!data) return <div className="p-4">Laden…</div>;

  return (
    <div className="p-4 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Beschikbaarheid per medewerker</h1>
        <a href="/admin/beschikbaarheid/nieuw" className="text-blue-600 underline">
          ➕ Nieuwe beschikbaarheid opgeven
        </a>
      </div>
      <table className="w-full border-collapse border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1 text-left">Naam</th>
            <th className="border px-2 py-1 text-left">Periode</th>
            <th className="border px-2 py-1 text-center">Max</th>
            {dagen.map((dag) => (
              <React.Fragment key={dag}>
                <th className="border px-2 py-1 text-center">{dag.charAt(0)}1</th>
                <th className="border px-2 py-1 text-center">{dag.charAt(0)}2</th>
              </React.Fragment>
            ))}
            <th className="border px-2 py-1 text-left">Opmerking</th>
            <th className="border px-2 py-1 text-left">Actie</th>
          </tr>
        </thead>
        <tbody>
          {data.map((regel) => (
            <tr key={regel.id}>
              <td className="border px-2 py-1 max-w-[100px] truncate" title={regel.naam}>
                {regel.naam}
              </td>
              <td className="border px-2 py-1 whitespace-nowrap">
                {new Date(regel.startdatum).toLocaleDateString("nl-NL")} –{' '}
                {new Date(regel.einddatum).toLocaleDateString("nl-NL")}
              </td>
              <td className="border px-2 py-1 text-center">
                {regel.max_shifts_per_week}
              </td>
              {dagen.map((dag) => (
                <React.Fragment key={`${regel.id}-${dag}`}> 
                  <td className="border px-2 py-1 text-center">{regel[`${dag}_1`] ? "✓" : ""}</td>
                  <td className="border px-2 py-1 text-center">{regel[`${dag}_2`] ? "✓" : ""}</td>
                </React.Fragment>
              ))}
              <td
                className="border px-2 py-1 max-w-[80px] truncate"
                title={regel.opmerkingen || ""}
              >
                {regel.opmerkingen || "-"}
              </td>
              <td className="border px-2 py-1">
                <button
                  onClick={() => handleDelete(regel.id)}
                  className="text-red-600 hover:text-red-800"
                  title="Verwijderen"
                >
                  ✖
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
