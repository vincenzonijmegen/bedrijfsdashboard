"use client";

import useSWR, { mutate } from "swr";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Functie } from "@/types/db";

export default function FunctieBeheerPagina() {
  const { data: functies } = useSWR<Functie[]>(
    "/api/functies",
    (url: string) => fetch(url).then((r) => r.json())
  );

  const [nieuweFunctie, setNieuweFunctie] = useState("");
  const [nieuweOmschrijving, setNieuweOmschrijving] = useState("");
  const [functiesState, setFunctiesState] = useState<Functie[]>([]);

  useEffect(() => {
    if (functies) setFunctiesState(functies);
  }, [functies]);

  const handleSave = async (functie: Functie) => {
    await fetch("/api/functies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(functie),
    });
    mutate("/api/functies");
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Weet je zeker dat je deze functie wilt verwijderen?")) return;
    const res = await fetch(`/api/functies?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.error) {
      alert("Kan niet verwijderen: " + json.error);
    } else {
      mutate("/api/functies");
    }
  };

  const handleAdd = async () => {
    if (!nieuweFunctie.trim()) return;
    await fetch("/api/functies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ naam: nieuweFunctie, omschrijving: nieuweOmschrijving }),
    });
    setNieuweFunctie("");
    setNieuweOmschrijving("");
    mutate("/api/functies");
  };

  const updateFunctie = (index: number, key: keyof Functie, value: string) => {
    const updated = [...functiesState];
    updated[index] = { ...updated[index], [key]: value };
    setFunctiesState(updated);
  };

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">🧾 Functiebeheer</h1>

      <div className="space-y-4">
        <input
          type="text"
          placeholder="Nieuwe functienaam"
          className="border px-3 py-2 rounded w-full"
          value={nieuweFunctie}
          onChange={(e) => setNieuweFunctie(e.target.value)}
        />
        <textarea
          placeholder="Omschrijving (optioneel)"
          className="border px-3 py-2 rounded w-full h-32"
          rows={6}
          value={nieuweOmschrijving}
          onChange={(e) => setNieuweOmschrijving(e.target.value)}
        />
        <button
          onClick={handleAdd}
          className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded"
        >
          ➕ Toevoegen
        </button>
      </div>

      <table className="w-full border text-sm mt-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Functie</th>
            <th className="p-2 text-left">Omschrijving</th>
            <th className="p-2 text-left">Opslaan</th>
            <th className="p-2 text-left">Verwijderen</th>
          </tr>
        </thead>
        <tbody>
          {functiesState.map((f, i) => (
            <tr key={f.id} className="border-t">
              <td className="p-2">
                <input
                  type="text"
                  className="border rounded px-2 py-1 w-full"
                  value={f.naam}
                  onChange={(e) => updateFunctie(i, "naam", e.target.value)}
                />
              </td>
              <td className="p-2">
                <textarea
                  className="border rounded px-2 py-1 w-full h-32"
                  rows={6}
                  value={f.omschrijving ?? ""}
                  onChange={(e) => updateFunctie(i, "omschrijving", e.target.value)}
                />
              </td>
              <td className="p-2">
                <button
                  onClick={() => handleSave(f)}
                  className="bg-green-600 text-white px-3 py-1 rounded"
                >
                  Opslaan
                </button>
              </td>
              <td className="p-2">
                <button
                  onClick={() => handleDelete(f.id)}
                  className="bg-red-600 text-white px-3 py-1 rounded"
                >
                  Verwijder
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
