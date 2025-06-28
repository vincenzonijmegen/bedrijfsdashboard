// admin/bestelpagina/page.tsx (client component)
"use client";

import { useEffect, useState } from "react";

interface Product {
  id: string;
  naam: string;
  leverancier: string;
  minVoorraad: number;
  bestelnummer: string;
  eenheid: string;
  prijs: number;
}

export default function BestelApp() {
  const [producten, setProducten] = useState<Product[]>([]);
  const [invoer, setInvoer] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/voorraad/artikelen")
      .then((res) => res.json())
      .then((data) => setProducten(data));
  }, []);

  const handleVerhogen = (id: string) => {
    setInvoer((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const handleVerlagen = (id: string) => {
    setInvoer((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) - 1) }));
  };

  const handleWissen = () => {
    setInvoer({});
  };

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">📦 Bestellijst</h1>

      {producten.map((product) => (
        <div
          key={product.id}
          className="flex items-center justify-between border rounded px-4 py-2 mb-2"
        >
          <div>
            <div className="font-medium text-slate-800">{product.naam}</div>
            <div className="text-xs text-slate-500">
              #{product.bestelnummer} - {product.eenheid} - €{product.prijs.toFixed(2)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleVerlagen(product.id)}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-2 py-1 rounded"
            >
              −
            </button>
            <span className="min-w-[24px] text-center">
              {invoer[product.id] || 0}
            </span>
            <button
              onClick={() => handleVerhogen(product.id)}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-2 py-1 rounded"
            >
              +
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={handleWissen}
        className="mt-6 bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded"
      >
        🧹 Wissen
      </button>
    </main>
  );
}
