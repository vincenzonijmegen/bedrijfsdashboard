"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";

interface Leverancier {
  id: number;
  naam: string;
}

interface Product {
  id: number;
  naam: string;
  besteleenheid?: number;
  huidige_prijs?: number;
  volgorde?: number;
}

type Invoer = Record<number, number>;

export default function BestelPagina() {
  const [leverancierId, setLeverancierId] = useState<number | null>(null);
  const [invoer, setInvoer] = useState<Invoer>({});

  const { data: leveranciers } = useSWR<Leverancier[]>("/api/leveranciers", fetcher);
  const { data: producten } = useSWR<Product[]>(
    leverancierId ? `/api/producten?leverancier=${leverancierId}` : null,
    fetcher
  );

  function wijzigAantal(productId: number, delta: number) {
    setInvoer((huidige) => {
      const nieuw = { ...huidige };
      nieuw[productId] = Math.max(0, (nieuw[productId] || 0) + delta);
      return nieuw;
    });
  }

  if (!leveranciers) return <p>Laden...</p>;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">📦 Bestellen</h1>

      <select
        className="border rounded px-3 py-2"
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
              <th className="text-left p-2">Product</th>
              <th className="text-left p-2">Eenheid</th>
              <th className="text-left p-2">Prijs</th>
              <th className="text-left p-2">Aantal</th>
              <th className="text-left p-2">Actie</th>
            </tr>
          </thead>
          <tbody>
            {[...producten].sort((a, b) => (a.volgorde ?? 999) - (b.volgorde ?? 999)).map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">{p.naam}</td>
                <td className="p-2">{p.besteleenheid ?? 1}</td>
                <td className="p-2">{p.huidige_prijs != null ? `€ ${Number(p.huidige_prijs).toFixed(2)}` : "–"}</td>
                <td className="p-2">{invoer[p.id] ?? 0}</td>
                <td className="p-2 space-x-2">
                  <button onClick={() => wijzigAantal(p.id, -1)} className="px-2 py-1 bg-gray-200 rounded">–</button>
                  <button onClick={() => wijzigAantal(p.id, 1)} className="px-2 py-1 bg-blue-600 text-white rounded">+</button>
                </td>
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
