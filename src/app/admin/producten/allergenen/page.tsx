"use client";

import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import { AlertTriangle, CheckCircle2, Loader2, Save } from "lucide-react";

const ALLERGENEN = ["gluten", "soja", "ei", "melk", "noten", "pinda", "tarwe"];

interface Product {
  id: number;
  naam: string;
}

export default function AllergenenBeheer() {
  const { data: producten, error } = useSWR<Product[]>("/api/producten", fetcher);
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

  if (error) {
    return (
      <main className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-5xl rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
          Fout bij laden producten.
        </div>
      </main>
    );
  }

  if (!producten) {
    return (
      <main className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Producten laden…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
            <AlertTriangle className="h-4 w-4" />
            Producten / Allergenen
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Allergenenbeheer
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Koppel allergenen aan producten voor receptuur en informatie.
          </p>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label>
            <span className="mb-1 block text-sm font-semibold text-slate-700">
              Product
            </span>
            <select
              value={geselecteerdId ?? ""}
              onChange={(e) =>
                setGeselecteerdId(e.target.value ? Number(e.target.value) : null)
              }
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">-- Kies een product --</option>
              {producten.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.naam}
                </option>
              ))}
            </select>
          </label>
        </section>

        {geselecteerdId && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-950">
                Allergenen aanvinken
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Selecteer welke allergenen dit product bevat.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {ALLERGENEN.map((a) => {
                const actief = allergenen.includes(a);

                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => {
                      setAllergenen((prev) =>
                        actief ? prev.filter((x) => x !== a) : [...prev, a]
                      );
                    }}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                      actief
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className="capitalize">{a}</span>
                    {actief && <CheckCircle2 className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>

            <button
              onClick={opslaan}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Save size={16} />
              Opslaan
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fout bij ophalen");
  return res.json();
}