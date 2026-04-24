"use client";

import * as React from "react";
import useSWR from "swr";

type Afspraak = {
  id: number;
  naam: string;
  email: string;
  starttijd: string;
  eindtijd: string;
  status: string;
  calendly_uri: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AfsprakenPage() {
  const [loading, setLoading] = React.useState(false);

  const { data, error, mutate } = useSWR<Afspraak[]>(
    "/api/calendly/afspraken",
    fetcher
  );

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Sollicitatiegesprekken</h1>

      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setLoading(true);

          try {
            const res = await fetch("/api/calendly/sync", {
              method: "POST",
            });

            if (!res.ok) {
              alert("Synchroniseren mislukt");
              return;
            }

            await mutate();
          } finally {
            setLoading(false);
          }
        }}
        className="mb-4 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? "Bezig..." : "🔄 Afspraken verversen"}
      </button>

      {error && (
        <div className="text-red-700 font-semibold">
          Afspraken konden niet worden geladen.
        </div>
      )}

      {!data && <div>Laden...</div>}

      {data && data.length === 0 && (
        <div className="text-slate-600">Nog geen afspraken gevonden.</div>
      )}

      {data && data.length > 0 && (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left p-3">Naam</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Start</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="p-3 font-medium">{a.naam}</td>
                  <td className="p-3">{a.email}</td>
                  <td className="p-3">
                    {new Date(a.starttijd).toLocaleString("nl-NL")}
                  </td>
                  <td className="p-3">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}