// src/app/admin/besteltool/producten/page.tsx

"use client";

import useSWR from "swr";
import { useState } from "react";

interface Leverancier {
  id: number;
  naam: string;
}

interface Product {
  id: number;
  naam: string;
  bestelnummer?: string;
  minimum_voorraad?: number;
  besteleenheid?: number;
  huidige_prijs?: number;
  actief: boolean;
}

export default function Productbeheer() {
  const [leverancierId, setLeverancierId] = useState<number | null>(null);
  const { data: leveranciers } = useSWR<Leverancier[]>("/api/leveranciers", fetcher);
  const { data: producten } = useSWR<Product[]>(
    leverancierId ? `/api/producten?leverancier=${leverancierId}` : null,
    fetcher
  );

  if (!leveranciers) return <p>Laden...</p>;

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">🛒 Productbeheer</h1>

      <select
        className="border rounded px-2 py-1"
        value={leverancierId ?? ""}
        onChange={(e) => setLeverancierId(Number(e.target.value))}
      >
        <option value="">-- Kies leverancier --</option>
        {leveranciers.map((l) => (
          <option key={l.id} value={l.id}>{l.naam}</option>
        ))}
      </select>

      {producten && (
        <table className="w-full text-sm border mt-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left p-2">Naam</th>
              <th className="text-left p-2">Bestelnummer</th>
              <th className="text-left p-2">Min</th>
              <th className="text-left p-2">Eenh.</th>
              <th className="text-left p-2">Prijs</th>
              <th className="text-left p-2">Actief</th>
            </tr>
          </thead>
          <tbody>
            {producten.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">{p.naam}</td>
                <td className="p-2">{p.bestelnummer}</td>
                <td className="p-2">{p.minimum_voorraad}</td>
                <td className="p-2">{p.besteleenheid}</td>
                <td className="p-2">€ {p.huidige_prijs?.toFixed(2)}</td>
                <td className="p-2">{p.actief ? "✅" : "❌"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fout bij ophalen");
  return res.json();
}
