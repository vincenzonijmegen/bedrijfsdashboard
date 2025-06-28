"use client";

import { useEffect, useState } from "react";

interface Product {
  id: string;
  naam: string;
  prijs: number;
  eenheid: string;
  bestelnummer: string;
}

export default function BestelPagina() {
  const [aantallen, setAantallen] = useState<{ [key: string]: number }>({});
  const [producten, setProducten] = useState<Product[]>([]);

  useEffect(() => {
    fetch("/api/voorraad/artikelen")
      .then((res) => res.json())
      .then((data) => setProducten(data));
  }, []);

  const wijzigAantal = (id: string, delta: number) => {
    setAantallen((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta),
    }));
  };

  const wisAlles = () => setAantallen({});

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-6">🧾 Besteloverzicht</h1>

      <table className="w-full border border-gray-300 text-sm mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left p-2">Artikel</th>
            <th className="text-left p-2">Bestelnummer</th>
            <th className="text-left p-2">Eenheid</th>
            <th className="text-left p-2">Prijs</th>
            <th className="text-center p-2">Aantal</th>
            <th className="text-center p-2"></th>
          </tr>
        </thead>
        <tbody>
          {producten.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="p-2">{p.naam}</td>
              <td className="p-2 text-xs text-gray-500">{p.bestelnummer}</td>
              <td className="p-2">{p.eenheid}</td>
              <td className="p-2">€ {p.prijs.toFixed(2).replace(".", ",")}</td>
              <td className="p-2 text-center font-semibold">
                {aantallen[p.id] || 0}
              </td>
              <td className="p-2 text-center">
                <button
                  className="px-2 py-0.5 rounded bg-sky-100 hover:bg-sky-200 text-sky-900 mr-1"
                  onClick={() => wijzigAantal(p.id, -1)}
                >
                  -
                </button>
                <button
                  className="px-2 py-0.5 rounded bg-sky-100 hover:bg-sky-200 text-sky-900"
                  onClick={() => wijzigAantal(p.id, 1)}
                >
                  +
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        className="bg-rose-100 hover:bg-rose-200 text-rose-900 px-4 py-2 rounded"
        onClick={wisAlles}
      >
        Wissen
      </button>
    </main>
  );
}
