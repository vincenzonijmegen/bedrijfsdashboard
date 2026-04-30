"use client";

import Link from "next/link";
import useSWR from "swr";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  IceCreamBowl,
  Loader2,
} from "lucide-react";

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

type CategorieItem = {
  slug: string;
  naam: string;
  sortering: number;
};

type CategorieApiResponse = {
  success: boolean;
  items: CategorieItem[];
  error?: string;
};

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  return res.json();
};

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
  const { data: categorieData } = useSWR<CategorieApiResponse>(
    "/api/keuken/categorieen",
    fetcher
  );

  const rows = data?.rows || [];
  const categorieen = categorieData?.items || [];

  const totaalBatches = rows.reduce(
    (sum, row) => sum + Number(row.keren_gemaakt || 0),
    0
  );

  const totaalItems = rows.reduce(
    (sum, row) => sum + Number(row.totaal_aantal || 0),
    0
  );

  const batchCategorieen = ["melksmaken", "vruchtensmaken"];

  const batchRows = rows.filter((row) =>
    batchCategorieen.includes(row.categorie)
  );

  const totaalBatchBatches = batchRows.reduce(
    (sum, row) => sum + Number(row.keren_gemaakt || 0),
    0
  );

  const totaalBatchAantal = batchRows.reduce(
    (sum, row) => sum + Number(row.totaal_aantal || 0),
    0
  );

  const gemiddeldeBatchgrootteIJs =
    totaalBatchBatches > 0
      ? (totaalBatchAantal / totaalBatchBatches).toFixed(1)
      : "0.0";

  const groupedRows = useMemo(() => {
    if (categorieen.length === 0) return [];

    return categorieen
      .map((categorie) => ({
        categorie: categorie.slug,
        titel: categorie.naam,
        sortering: categorie.sortering,
        items: rows.filter((row) => row.categorie === categorie.slug),
      }))
      .filter((groep) => groep.items.length > 0);
  }, [rows, categorieen]);

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
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
                <BarChart3 className="h-4 w-4" />
                Keuken / Productie rapportage
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Productie rapportage keuken
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Overzicht van hoe vaak smaken en producten zijn gemaakt.
              </p>
            </div>

            <Link
              href="/admin"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowLeft size={16} />
              Terug naar dashboard
            </Link>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <CalendarDays size={20} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Periode selecteren
              </h2>
              <p className="text-sm text-slate-500">
                Kies een datumrange of gebruik een snelle selectie.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[220px_220px_1fr] lg:items-end">
            <label>
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Startdatum
              </span>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label>
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Einddatum
              </span>
              <input
                type="date"
                value={einde}
                onChange={(e) => setEinde(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button
                type="button"
                onClick={setVandaag}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Vandaag
              </button>
              <button
                type="button"
                onClick={setDezeWeek}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Deze week
              </button>
              <button
                type="button"
                onClick={setDezeMaand}
                className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Deze maand
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
              <div className="text-xs font-medium uppercase tracking-wide text-blue-600">
                Batches
              </div>
              <div className="text-2xl font-bold text-blue-950">
                {totaalBatches}
              </div>
            </div>

            <div className="rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
              <div className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                Totaal gemaakt
              </div>
              <div className="text-2xl font-bold text-emerald-950">
                {totaalItems}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Gem. batchgrootte ijs
              </div>
              <div className="text-2xl font-bold text-slate-950">
                {gemiddeldeBatchgrootteIJs}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Alleen melksmaken en vruchtensmaken
              </p>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
            <p className="text-sm text-slate-500">Rapportage laden…</p>
          </div>
        ) : error || !data?.success ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700 shadow-sm">
            Fout bij laden van rapportage.
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Geen productiegegevens gevonden in deze periode.
          </div>
        ) : (
          <div className="space-y-6">
            {groupedRows.map((groep) => (
              <section
                key={groep.categorie}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                      <IceCreamBowl size={20} />
                    </div>

                    <div>
                      <h2 className="text-lg font-bold text-slate-950">
                        {groep.titel}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {groep.items.length} item
                        {groep.items.length === 1 ? "" : "s"} in deze categorie.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="border-b border-slate-200 px-4 py-3">
                          Recept
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3">
                          Keren gemaakt
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3">
                          Totaal aantal
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3">
                          Laatste keer
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {groep.items.map((row, index) => (
                        <tr
                          key={`${row.recept_id}-${row.recept_naam}`}
                          className={`transition hover:bg-slate-50 ${
                            index < 3 ? "bg-amber-50/50" : ""
                          }`}
                        >
                          <td className="px-4 py-3 font-semibold text-slate-950">
                            {row.recept_naam}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {row.keren_gemaakt}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {row.totaal_aantal}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">
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
      </div>
    </main>
  );
}