// src/app/admin/aftekenlijsten/page.tsx
"use client";

import useSWR from "swr";
import Link from "next/link";

interface Lijst {
  id: number;
  categorie: string;
  week: number;
  jaar: number;
  bestand_url: string;
  opmerking?: string;
  upload_datum: string;
}

const categorieNamen: Record<string, string> = {
  "winkel-begin": "Winkel – begin",
  "winkel-eind": "Winkel – eind",
  "keuken-begin": "Keuken – begin",
  "keuken-eind": "Keuken – eind",
};

export default function AftekenlijstenOverzicht() {
  const { data, error } = useSWR<Lijst[]>("/api/aftekenlijsten", (url) => fetch(url).then((r) => r.json()));

  if (error) return <p className="p-4 text-red-600">Fout bij laden</p>;
  if (!data) return <p className="p-4">Laden…</p>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Aftekenlijsten per week</h1>

      <table className="w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-3 py-2 text-left">Categorie</th>
            <th className="border px-3 py-2 text-left">Week</th>
            <th className="border px-3 py-2 text-left">Jaar</th>
            <th className="border px-3 py-2 text-left">Bestand</th>
            <th className="border px-3 py-2 text-left">Opmerking</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.id}>
              <td className="border px-3 py-2">{categorieNamen[r.categorie] || r.categorie}</td>
              <td className="border px-3 py-2">{r.week}</td>
              <td className="border px-3 py-2">{r.jaar}</td>
              <td className="border px-3 py-2 text-blue-600 underline">
                <a href={r.bestand_url} target="_blank" rel="noopener noreferrer">Download</a>
              </td>
              <td className="border px-3 py-2">{r.opmerking || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
