"use client";

import useSWR from "swr";

interface Resultaat {
  id: string;
  email: string;
  naam: string;
  score: number;
  juist: number;
  totaal: number;
  slug: string;
  tijdstip: string;
}

const fetcher = async (url: string): Promise<Resultaat[]> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fout bij ophalen resultaten");
  return res.json();
};

export default function ResultatenOverzicht() {
  const { data, error } = useSWR("/api/resultaten", fetcher, { refreshInterval: 3000 });

  if (error) return <div>Fout bij laden van resultaten.</div>;
  if (!data) return <div>Laden...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">📊 Toetsresultaten</h1>
      <table className="w-full text-sm border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">E-mail</th>
            <th className="border p-2 text-left">Naam</th>
            <th className="border p-2 text-center">Score</th>
            <th className="border p-2 text-center">Goed / Totaal</th>
            <th className="border p-2 text-center">Slug</th>
            <th className="border p-2 text-center">Tijdstip</th>
<th className="border p-2 text-center">Actie</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i}>
              <td className="border p-2">{r.email}</td>
              <td className="border p-2">{r.naam}</td>
              <td className="border p-2 text-center">{r.score}%</td>
              <td className="border p-2 text-center">{r.juist} / {r.totaal}</td>
              <td className="border p-2 text-center">{r.slug}</td>
              <td className="border p-2 text-center">{new Date(r.tijdstip).toLocaleString()}</td>
<td className="border p-2 text-center">
  <button
    onClick={async () => {
      if (confirm(`Verwijder resultaat van ${r.naam}?`)) {
      await fetch(`/api/resultaten?email=${encodeURIComponent(r.email)}&slug=${encodeURIComponent(r.slug)}`, {
      method: "DELETE",
      });

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
