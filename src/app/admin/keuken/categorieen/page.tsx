"use client";

import { useEffect, useState } from "react";

type Categorie = {
  id: number;
  slug: string;
  naam: string;
  sortering: number;
};

export default function CategorieenPage() {
  const [categorieen, setCategorieen] = useState<Categorie[]>([]);
  const [naam, setNaam] = useState("");

  async function load() {
    const res = await fetch("/api/keuken/categorieen");
    const data = await res.json();

    if (data.success) {
      setCategorieen(data.items);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addCategorie() {
    if (!naam.trim()) return;

    const slug = naam
      .toLowerCase()
      .replace(/\s+/g, "-");

    await fetch("/api/admin/keuken/categorieen", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        naam,
        slug,
      }),
    });

    setNaam("");
    load();
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        Categorieën beheren
      </h1>

      <div className="mb-6 flex gap-3">
        <input
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
          placeholder="Nieuwe categorie"
          className="flex-1 border rounded-xl px-4 py-3"
        />
        <button
          onClick={addCategorie}
          className="bg-slate-900 text-white px-4 py-3 rounded-xl"
        >
          Toevoegen
        </button>
      </div>

      <div className="space-y-3">
        {categorieen.map((cat) => (
          <div
            key={cat.id}
            className="border rounded-xl px-4 py-3 flex justify-between"
          >
            <div>
              <div className="font-semibold">{cat.naam}</div>
              <div className="text-sm text-slate-500">{cat.slug}</div>
            </div>
            <div className="text-sm text-slate-500">
              volgorde {cat.sortering}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}