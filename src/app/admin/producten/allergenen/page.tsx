// src/app/admin/producten/allergenen/page.tsx

"use client";

import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";

const ALLERGENEN = ["gluten", "soja", "ei", "melk", "noten", "pinda", "tarwe"];

interface Product {
  id: number;
  naam: string;
}

export default function AllergenenBeheer() {
  const { data: producten } = useSWR<Product[]>("/api/producten", fetcher);
  const [geselecteerdId, setGeselecteerdId] = useState<number | null>(null);
  const [allergenen, setAllergenen] = useState<string[]>([]);

  useEffect(() => {
    if (geselecteerdId != null) {
      fetch(`/api/allergenen?product_id=${geselecteerdId}`)
        .then((res) => res.json())
        .then((data) => setAllergenen(data));
    }
  }, [geselecteerdId]);

  async function opslaan() {
    await fetch("/api/allergenen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: geselecteerdId, allergenen }),
    });
    mutate("/api/allergenen");
    alert("Opgeslagen!");
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">🥜 Allergenenbeheer</h1>

      <select
        value={geselecteerdId ?? ""}
        onChange={(e) => setGeselecteerdId(Number(e.target.value))}
        className="border px-2 py-1 rounded"
      >
        <option value="">-- Kies een product --</option>
        {producten?.map((p) => (
          <option key={p.id} value={p.id}>{p.naam}</option>
        ))}
      </select>

      {geselecteerdId && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">Vink aan welke allergenen dit product bevat:</p>
          <div className="grid grid-cols-2 gap-2">
            {ALLERGENEN.map((a) => (
              <label key={a} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allergenen.includes(a)}
                  onChange={(e) => {
                    setAllergenen((prev) =>
                      e.target.checked
                        ? [...prev, a]
                        : prev.filter((x) => x !== a)
                    );
                  }}
                />
                {a}
              </label>
            ))}
          </div>
          <button
            onClick={opslaan}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
          >
            Opslaan
          </button>
        </div>
      )}
    </main>
  );
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fout bij ophalen");
  return res.json();
}
