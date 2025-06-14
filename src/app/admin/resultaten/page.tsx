
"use client";

import useSWR, { mutate } from "swr";
import { useState } from "react";

interface Resultaat {
  id: string;
  email: string;
  naam: string;
  score: number;
  juist: number;
  totaal: number;
  titel: string;
  tijdstip: string;
}

const fetcher = async (url: string): Promise<Resultaat[]> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fout bij ophalen resultaten");
  return res.json();
};

export default function ResultatenOverzicht() {
  const [filterEmail, setFilterEmail] = useState<string>("alle");
  const { data, error } = useSWR("/api/resultaten", fetcher, { refreshInterval: 3000 });

  if (error) return <div>Fout bij laden van resultaten.</div>;
  if (!data) return <div>Laden...</div>;

  const uniekeEmails = Array.from(new Set(data.map((r) => r.email))).sort();
  const gefilterd = filterEmail === "alle"
    ? data
    : data.filter((r) => r.email === filterEmail);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">📊 Toetsresultaten</h1>

      <div className="mb-4">
        <label className="mr-2 font-medium">Filter op medewerker:</label>
        <select
          value={filterEmail}
          onChange={(e) => setFilterEmail(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="alle">Alle medewerkers</option>
          {uniekeEmails.map((email) => (
            <option key={email} value={email}>
              {email}
            </option>
          ))}
        </select>
      </div>

      <table className="w-full text-sm border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">E-mail</th>
            <th className="border p-2 text-left">Naam</th>
            <th className="border p-2 text-center">Score</th>
            <th className="border p-2 text-center">Goed / Totaal</th>
            <th className="border p-2 text-center">Titel</th>
            <th className="border p-2 text-center">Tijdstip</th>
            <th className="border p-2 text-center">Actie</th>
          </tr>
        </thead>
        <tbody>
          {gefilterd.map((r, i) => (
            <tr key={i}>
              <td className="border p-2">{r.email}</td>
              <td className="border p-2">{r.naam}</td>
              <td className="border p-2 text-center">{r.score}%</td>
              <td className="border p-2 text-center">{r.juist} / {r.totaal}</td>
              <td className="border p-2 text-center">{r.titel}</td>
              <td className="border p-2 text-center">{new Date(r.tijdstip).toLocaleString()}</td>
              <td className="border p-2 text-center">
                <button
                  onClick={async () => {
                    if (confirm(`Verwijder resultaat van ${r.naam}?`)) {
                      await fetch(
                        `/api/resultaten?email=${encodeURIComponent(r.email)}&titel=${encodeURIComponent(r.titel)}`,
                        { method: "DELETE" }
                      );
                      mutate("/api/resultaten");
                    }
                  }}
                  className="text-red-600 underline text-sm"
                >
                  Verwijderen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
