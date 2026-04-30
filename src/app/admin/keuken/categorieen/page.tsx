"use client";

import { useEffect, useState } from "react";
import { FolderTree, Loader2, Plus } from "lucide-react";

type Categorie = {
  id: number;
  slug: string;
  naam: string;
  sortering: number;
};

export default function CategorieenPage() {
  const [categorieen, setCategorieen] = useState<Categorie[]>([]);
  const [naam, setNaam] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/keuken/categorieen");
    const data = await res.json();

    if (data.success) setCategorieen(data.items);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addCategorie() {
    if (!naam.trim()) return;

    const slug = naam.toLowerCase().trim().replace(/\s+/g, "-");

    await fetch("/api/admin/keuken/categorieen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ naam, slug }),
    });

    setNaam("");
    load();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Categorieën laden…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
            <FolderTree className="h-4 w-4" />
            Keuken / Categorieën
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Categorieën beheren
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Beheer rubrieken voor recepten, maaklijst en productierapportage.
          </p>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold text-slate-950">
            Nieuwe categorie
          </h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <input
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              placeholder="Nieuwe categorie"
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />

            <button
              onClick={addCategorie}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={16} />
              Toevoegen
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">
              Bestaande categorieën
            </h2>
            <p className="text-sm text-slate-500">
              {categorieen.length} categorie
              {categorieen.length === 1 ? "" : "ën"} gevonden.
            </p>
          </div>

          {categorieen.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              Nog geen categorieën aangemaakt.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {categorieen.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50"
                >
                  <div>
                    <div className="font-semibold text-slate-950">
                      {cat.naam}
                    </div>
                    <div className="text-sm text-slate-500">{cat.slug}</div>
                  </div>

                  <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                    volgorde {cat.sortering}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}