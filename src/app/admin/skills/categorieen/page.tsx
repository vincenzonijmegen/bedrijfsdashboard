// src/app/admin/skills/categorieen/page.tsx
"use client";

import { useEffect, useState } from "react";

interface Categorie {
  id: string;
  naam: string;
  volgorde?: number;
}

export default function SkillCategorieen() {
  const [categorieen, setCategorieen] = useState<Categorie[]>([]);
  const [nieuw, setNieuw] = useState({ naam: "", volgorde: "" });
  const [succes, setSucces] = useState(false);

  useEffect(() => {
    fetch("/api/skills/categorieen")
      .then((res) => res.json())
      .then((data) => setCategorieen(data));
  }, [succes]);

  const update = (index: number, veld: keyof Categorie, waarde: string) => {
    const kopie = [...categorieen];
    (kopie[index] as any)[veld] = waarde;
    setCategorieen(kopie);
  };

  const opslaan = async (cat: Categorie) => {
    const res = await fetch("/api/skills/categorieen", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cat),
    });
    if (res.ok) setSucces(true);
  };

  const toevoegen = async () => {
    if (!nieuw.naam.trim()) return;
    const res = await fetch("/api/skills/categorieen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nieuw),
    });
    if (res.ok) {
      setNieuw({ naam: "", volgorde: "" });
      setSucces(true);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">🏷️ Skillcategorieën</h1>

      <div className="bg-slate-50 p-4 rounded border">
        <h2 className="font-semibold mb-2">➕ Nieuwe categorie</h2>
        <div className="flex gap-4 mb-2">
          <input
            value={nieuw.naam}
            onChange={(e) => setNieuw({ ...nieuw, naam: e.target.value })}
            placeholder="Naam"
            className="border px-2 py-1 rounded w-1/2"
          />
          <input
            value={nieuw.volgorde}
            onChange={(e) => setNieuw({ ...nieuw, volgorde: e.target.value })}
            placeholder="Volgorde (optioneel)"
            className="border px-2 py-1 rounded w-1/2"
          />
          <button onClick={toevoegen} className="bg-green-600 text-white px-4 rounded">
            Toevoegen
          </button>
        </div>
      </div>

      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-slate-100">
            <th className="border p-2 text-left">Naam</th>
            <th className="border p-2 text-left">Volgorde</th>
            <th className="border p-2"></th>
          </tr>
        </thead>
        <tbody>
          {categorieen.map((cat, i) => (
            <tr key={cat.id}>
              <td className="border p-2">
                <input
                  value={cat.naam}
                  onChange={(e) => update(i, "naam", e.target.value)}
                  className="w-full border rounded px-2 py-1"
                />
              </td>
              <td className="border p-2">
                <input
                  value={cat.volgorde || ""}
                  onChange={(e) => update(i, "volgorde", e.target.value)}
                  className="w-full border rounded px-2 py-1"
                />
              </td>
              <td className="border p-2 space-x-2">
  <button
    onClick={() => opslaan(cat)}
    className="bg-blue-600 text-white px-3 py-1 rounded"
  >
    Opslaan
  </button>
  <button
    onClick={async () => {
      if (!confirm("Weet je zeker dat je deze categorie wilt verwijderen?")) return;
      const res = await fetch(`/api/skills/categorieen?id=${cat.id}`, { method: "DELETE" });
      if (res.ok) setSucces(true);
      else alert("Kan niet verwijderen: categorie wordt nog gebruikt.");
    }}
    className="bg-red-600 text-white px-3 py-1 rounded"
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
