// src/app/admin/functies/page.tsx
"use client";

import { useEffect, useState } from "react";

interface Functie {
  id: number;
  naam: string;
  omschrijving: string;
}

export default function FunctieBeheer() {
  const [nieuweFunctie, setNieuweFunctie] = useState({ naam: "", omschrijving: "" });
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

  const verwijderen = async (id: number) => {
    if (!confirm("Weet je zeker dat je deze functie wilt verwijderen?")) return;
    const res = await fetch(`/api/functies?id=${id}`, { method: "DELETE" });
    if (res.ok) setSucces(true);
    else alert("Kan functie niet verwijderen. Mogelijk is deze nog gekoppeld aan een medewerker.");
  };

  const toevoegen = async () => {
    if (!nieuweFunctie.naam.trim()) return;
    const res = await fetch("/api/functies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nieuweFunctie),
    });
    if (res.ok) {
      setSucces(true);
      setNieuweFunctie({ naam: "", omschrijving: "" });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">🛠 Functiebeheer</h1>

      <div className="bg-gray-50 border p-4 rounded">
        <h2 className="font-semibold mb-2">➕ Nieuwe functie toevoegen</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <input
            type="text"
            placeholder="Naam"
            value={nieuweFunctie.naam}
            onChange={(e) => setNieuweFunctie({ ...nieuweFunctie, naam: e.target.value })}
            className="border rounded px-2 py-1"
          />
          <input
            type="text"
            placeholder="Omschrijving (optioneel)"
            value={nieuweFunctie.omschrijving}
            onChange={(e) => setNieuweFunctie({ ...nieuweFunctie, omschrijving: e.target.value })}
            className="border rounded px-2 py-1"
          />
          <button
            onClick={toevoegen}
            className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700"
          >
            Toevoegen
          </button>
        </div>
      </div>

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
              <td className="border p-2">
                <input
                  type="text"
                  value={f.naam}
                  onChange={(e) => updateFunctie(i, "naam", e.target.value)}
                  className="w-full border rounded px-2 py-1"
                />
              </td>
              <td className="border p-2">
                <textarea
                  value={f.omschrijving || ""}
                  onChange={(e) => updateFunctie(i, "omschrijving", e.target.value)}
                  className="w-full border rounded px-2 py-1 h-24"
                />
              </td>
              <td className="border p-2 space-x-2">
                <button
                  onClick={() => opslaan(f)}
                  className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                >
                  Opslaan
                </button>
                <button
                  onClick={() => verwijderen(f.id)}
                  className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                >
                  ❌
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
