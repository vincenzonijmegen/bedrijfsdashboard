// src/app/admin/functies/page.tsx
"use client";

import { useEffect, useState } from "react";

interface Functie {
  id: number;
  naam: string;
  omschrijving: string;
}

export default function FunctieBeheer() {
  const [functies, setFuncties] = useState<Functie[]>([]);
  const [succes, setSucces] = useState(false);

  useEffect(() => {
    fetch("/api/functies")
      .then((res) => res.json())
      .then((data) => setFuncties(data));
  }, [succes]);

  const updateFunctie = (index: number, veld: string, waarde: string) => {
    const kopie = [...functies];
    (kopie[index] as any)[veld] = waarde;
    setFuncties(kopie);
  };

  const opslaan = async (functie: Functie) => {
    const res = await fetch("/api/functies", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(functie),
    });
    if (res.ok) setSucces(true);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">🛠 Functiebeheer</h1>

      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left w-1/3">Naam</th>
            <th className="border p-2 text-left">Omschrijving</th>
            <th className="border p-2"></th>
          </tr>
        </thead>
        <tbody>
          {functies.map((f, i) => (
            <tr key={f.id}>
              <td className="border p-2">{f.naam}</td>
              <td className="border p-2">
                <textarea
                  value={f.omschrijving || ""}
                  onChange={(e) => updateFunctie(i, "omschrijving", e.target.value)}
                  className="w-full border rounded px-2 py-1 h-24"
                />
              </td>
              <td className="border p-2">
                <button
                  onClick={() => opslaan(f)}
                  className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                >
                  Opslaan
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
