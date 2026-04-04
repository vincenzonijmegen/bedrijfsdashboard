"use client";

import Link from "next/link";
import useSWR from "swr";
import { useMemo, useState } from "react";

type RapportRow = {
  recept_id: number;
  recept_naam: string;
  categorie: string;
  keren_gemaakt: string;
  totaal_aantal: string;
  laatste_keer: string;
};

type ApiResponse = {
  success: boolean;
  rows: RapportRow[];
  error?: string;
};

const fetcher = async (url: string): Promise<ApiResponse> => {
  const res = await fetch(url);
  return res.json();
};

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

function vandaagAlsInput() {
  return new Date().toISOString().slice(0, 10);
}

function zevenDagenTerug() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function eersteDagVanMaand() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function formatLaatsteKeer(value: string) {
  if (!value) return "-";

  const d = new Date(value);
  const vandaag = new Date();

  const zelfdeDag =
    d.getFullYear() === vandaag.getFullYear() &&
    d.getMonth() === vandaag.getMonth() &&
    d.getDate() === vandaag.getDate();

  if (zelfdeDag) {
    return `Vandaag ${d.toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  return d.toLocaleString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function KeukenProductieLogPage() {
  const [start, setStart] = useState(zevenDagenTerug());
  const [einde, setEinde] = useState(vandaagAlsInput());

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (einde) params.set("einde", einde);
    return `/api/admin/keuken/productie-log?${params.toString()}`;
  }, [start, einde]);

  const { data, error, isLoading } = useSWR<ApiResponse>(url, fetcher);

  const rows = data?.rows || [];

  const totaalBatches = rows.reduce(
    (sum, row) => sum + Number(row.keren_gemaakt || 0),
    0
  );

  const totaalItems = rows.reduce(
    (sum, row) => sum + Number(row.totaal_aantal || 0),
    0
  );

  const gemiddeldeBatchgrootte =
    totaalBatches > 0 ? (totaalItems / totaalBatches).toFixed(1) : "0.0";

  const groupedRows = useMemo(() => {
    return categorieVolgorde
      .map((categorie) => ({
        categorie,
        titel: categorieTitels[categorie] || categorie,
        items: rows.filter((row) => row.categorie === categorie),
      }))
      .filter((groep) => groep.items.length > 0);
  }, [rows]);

  function setVandaag() {
    const vandaag = vandaagAlsInput();
    setStart(vandaag);
    setEinde(vandaag);
  }

  function setDezeWeek() {
    setStart(zevenDagenTerug());
    setEinde(vandaagAlsInput());
  }

  function setDezeMaand() {
    setStart(eersteDagVanMaand());
    setEinde(vandaagAlsInput());
  }

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Admin
          </p>
          <h1 className="text-3xl font-bold text-slate-900">
            Productie rapportage keuken
          </h1>
          <p className="mt-2 text-slate-600">
            Overzicht van hoe vaak smaken en producten zijn gemaakt.
          </p>
        </div>

        <Link
          href="/admin"
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ← Terug naar dashboard
        </Link>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[220px_220px_1fr] lg:items-end">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Startdatum
            </label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Einddatum
            </label>
            <input
              type="date"
              value={einde}
              onChange={(e) => setEinde(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
            />
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button
              type="button"
              onClick={setVandaag}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Vandaag
            </button>
            <button
              type="button"
              onClick={setDezeWeek}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Deze week
            </button>
            <button
              type="button"
              onClick={setDezeMaand}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Deze maand
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-slate-100 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Batches
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {totaalBatches}
            </div>
          </div>

          <div className="rounded-xl bg-slate-100 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Totaal gemaakt
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {totaalItems}
            </div>
          </div>

          <div className="rounded-xl bg-slate-100 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Gem. batchgrootte
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {gemiddeldeBatchgrootte}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-500 shadow-sm">
          Rapportage laden...
        </div>
      ) : error || !data?.success ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700 shadow-sm">
          Fout bij laden van rapportage.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-slate-500 shadow-sm">
          Geen productiegegevens gevonden in deze periode.
        </div>
      ) : (
        <div className="space-y-8">
          {groupedRows.map((groep) => (
            <section
              key={groep.categorie}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  {groep.titel}
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-white text-slate-700">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Recept</th>
                      <th className="px-4 py-3 font-semibold">Keren gemaakt</th>
                      <th className="px-4 py-3 font-semibold">Totaal aantal</th>
                      <th className="px-4 py-3 font-semibold">Laatste keer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groep.items.map((row, index) => (
                      <tr
                        key={`${row.recept_id}-${row.recept_naam}`}
                        className={`border-t border-slate-100 ${
                          index < 3 ? "bg-amber-50/40" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {row.recept_naam}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.keren_gemaakt}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.totaal_aantal}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatLaatsteKeer(row.laatste_keer)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}