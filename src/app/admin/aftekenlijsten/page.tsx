// src/app/admin/aftekenlijsten/page.tsx
"use client";

import useSWR from "swr";
import Link from "next/link";
import { useState } from "react";

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
  const { data, mutate, error } = useSWR<Lijst[]>("/api/aftekenlijsten", (url: string) => fetch(url).then((r) => r.json()));
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const handleDelete = async (id: number) => {
    if (!confirm("Weet je zeker dat je deze aftekenlijst wilt verwijderen?")) return;
    const res = await fetch(`/api/aftekenlijsten/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json?.snackbar?.message) setSnackbar(json.snackbar.message);
    mutate();
    setTimeout(() => setSnackbar(null), 4000);
  };

  if (error) return <p className="p-4 text-red-600">Fout bij laden</p>;
  if (!data) return <p className="p-4">Laden…</p>;

  const haccp = data.filter(d => d.categorie !== "incidenteel");
  const incidenteel = data.filter(d => d.categorie === "incidenteel");

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Aftekenlijsten per week</h1>

      {snackbar && (
        <div className="mb-4 px-4 py-2 bg-green-100 text-green-800 rounded border border-green-300">
          {snackbar}
        </div>
      )}

      <p className="mb-4">
        <Link href="/admin/aftekenlijsten/upload" className="text-blue-600 underline">➕ Nieuwe aftekenlijst uploaden</Link>
      </p>

      <h2 className="text-lg font-semibold mb-2 mt-6">HACCP-lijsten</h2>
      <table className="w-full border text-sm mb-8">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-3 py-2 text-left">Categorie</th>
            <th className="border px-3 py-2 text-left">Week</th>
            <th className="border px-3 py-2 text-left">Jaar</th>
            <th className="border px-3 py-2 text-left">Bestand</th>
            <th className="border px-3 py-2 text-left">Opmerking</th>
            <th className="border px-3 py-2 text-left">Actie</th>
          </tr>
        </thead>
        <tbody>
          {haccp.map((r) => (
            <tr key={r.id}>
              <td className="border px-3 py-2">{categorieNamen[r.categorie] || r.categorie}</td>
              <td className="border px-3 py-2">{r.week}</td>
              <td className="border px-3 py-2">{r.jaar}</td>
              <td className="border px-3 py-2 text-blue-600 underline">
                <a href={r.bestand_url} target="_blank" rel="noopener noreferrer">Download</a>
              </td>
              <td className="border px-3 py-2">{r.opmerking || "-"}</td>
              <td className="border px-3 py-2">
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-red-600 hover:underline"
                >
                  Verwijderen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {incidenteel.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-2 mt-6">Incidentele lijsten</h2>
          <table className="w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-3 py-2 text-left">Opmerking</th>
                <th className="border px-3 py-2 text-left">Week</th>
                <th className="border px-3 py-2 text-left">Jaar</th>
                <th className="border px-3 py-2 text-left">Bestand</th>
                <th className="border px-3 py-2 text-left">Actie</th>
              </tr>
            </thead>
            <tbody>
              {incidenteel.map((r) => (
                <tr key={r.id}>
                  <td className="border px-3 py-2">{r.opmerking || "-"}</td>
                  <td className="border px-3 py-2">{r.week}</td>
                  <td className="border px-3 py-2">{r.jaar}</td>
                  <td className="border px-3 py-2 text-blue-600 underline">
                    <a href={r.bestand_url} target="_blank" rel="noopener noreferrer">Download</a>
                  </td>
                  <td className="border px-3 py-2">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-red-600 hover:underline"
                    >
                      Verwijderen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <button
  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
  className="fixed bottom-6 left-6 bg-blue-600 text-white rounded-full p-2 shadow-lg hover:bg-blue-700 transition"
  aria-label="Scroll naar boven"
>
  ↑
</button>

    </div>
  );
}
