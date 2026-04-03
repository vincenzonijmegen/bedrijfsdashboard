"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type MaaklijstItem = {
  id: number;
  categorie: string;
  naam: string;
};

const STORAGE_KEY = "keuken-maaklijst-v1";

const categorieTitels: Record<string, string> = {
  melksmaken: "Melksmaken",
  vruchtensmaken: "Vruchtensmaken",
  suikervrij: "Suikervrij",
  sauzen: "Sauzen",
};

const categorieVolgorde = [
  "melksmaken",
  "vruchtensmaken",
  "suikervrij",
  "sauzen",
];

export default function MaaklijstPage() {
  const [items, setItems] = useState<MaaklijstItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSelectedIds(parsed.filter((v) => typeof v === "number"));
        }
      }
    } catch {
      // niets doen
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedIds));
  }, [selectedIds]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/keuken/maaklijst-items", {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || "Fout bij ophalen");
          setLoading(false);
          return;
        }

        setItems(data.items || []);
      } catch (error) {
        console.error(error);
        setError("Fout bij ophalen");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  function toggleItem(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function clearList() {
    setSelectedIds([]);
  }

  const grouped = useMemo(() => {
    return categorieVolgorde.map((categorie) => ({
      categorie,
      titel: categorieTitels[categorie] || categorie,
      items: items.filter((item) => item.categorie === categorie),
    }));
  }, [items]);

  const selectedItems = useMemo(() => {
    return items.filter((item) => selectedIds.includes(item.id));
  }, [items, selectedIds]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">
            Maaklijst laden...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/keuken"
              className="mb-3 inline-flex items-center text-slate-600"
            >
              ← Terug
            </Link>

            <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">
              Maaklijst
            </h1>
            <p className="mt-2 text-slate-600">
              Klik aan wat vandaag bijgemaakt moet worden.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-900 px-4 py-3 text-lg font-semibold text-white">
              {selectedItems.length} te maken
            </div>

            <button
              type="button"
              onClick={clearList}
              disabled={selectedItems.length === 0}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
            >
              Wissen
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="space-y-8">
          {grouped.map((groep) => (
            <section key={groep.categorie}>
              <h2 className="mb-3 text-2xl font-semibold text-slate-900">
                {groep.titel}
              </h2>

              {groep.items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-slate-500">
                  Geen items in deze categorie.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                  {groep.items.map((item) => {
                    const selected = selectedIds.includes(item.id);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        className={`flex h-[96px] items-center justify-center rounded-2xl border px-3 py-3 text-center shadow-sm transition active:scale-95 ${
                          selected
                            ? "border-emerald-300 bg-emerald-100 text-emerald-900"
                            : "border-slate-200 bg-white text-slate-900"
                        }`}
                      >
                        <span className="block max-w-[170px] text-lg font-semibold leading-snug">
                          {item.naam}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>

        <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-slate-900">
              Vandaag maken
            </h2>
            <div className="text-sm text-slate-500">
              {selectedItems.length} geselecteerd
            </div>
          </div>

          {selectedItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-slate-500">
              Nog niets geselecteerd.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div>
                    <div className="text-lg font-semibold text-slate-900">
                      {item.naam}
                    </div>
                    <div className="text-sm text-slate-500">
                      {categorieTitels[item.categorie] || item.categorie}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/keuken/recepturen/${item.categorie}/${item.id}`}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                    >
                      Recept
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                    >
                      Verwijder
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}