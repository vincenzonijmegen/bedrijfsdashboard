"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type FeestdagRow = {
  datum: string;
  dag: string;
  naam: string;
  feestdag: string;
  omzet: string | number;
  aantal: number;
  bron?: string | null;
  weer_omschrijving?: string | null;
  weather_code?: number | null;
  temp_min?: string | number | null;
  temp_max?: string | number | null;
  neerslag_mm?: string | number | null;
};

function euro(value: string | number | null | undefined) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

function number1(value: string | number | null | undefined) {
  if (value == null || value === "") return "—";
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number(value));
}

function formatDatum(isoLike: string) {
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return isoLike;
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export default function FeestdagOmzetPage() {
  const now = useMemo(() => new Date(), []);
  const huidigeJaar = now.getFullYear();

  const [jaar, setJaar] = useState<number>(huidigeJaar);
  const [rows, setRows] = useState<FeestdagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const jaren = useMemo(() => {
    const lijst: number[] = [];
    for (let y = huidigeJaar; y >= 2024; y--) lijst.push(y);
    return lijst;
  }, [huidigeJaar]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/rapportage/feestdagomzet?jaar=${jaar}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.detail || json?.error || "Onbekende fout");
      }

      setRows(Array.isArray(json) ? json : []);
    } catch (e: any) {
      setError(e?.message ?? "Fout bij laden");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [jaar]);

  const totalen = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.omzet += Number(row.omzet ?? 0);
        acc.aantal += Number(row.aantal ?? 0);
        return acc;
      },
      { omzet: 0, aantal: 0 }
    );
  }, [rows]);

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/admin/rapportage/financieel"
              className="mb-3 inline-flex text-sm text-blue-700 hover:underline"
            >
              ← Terug naar financieel
            </Link>

            <h1 className="text-2xl font-bold text-slate-900">
              Feestdagenomzet
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Omzet per feestdag inclusief historische weersituatie.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="jaar" className="text-sm font-medium text-slate-700">
              Jaar
            </label>
            <select
              id="jaar"
              value={jaar}
              onChange={(e) => setJaar(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              {jaren.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <button
              onClick={load}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Vernieuwen
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Feestdagen</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {rows.length}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Totale omzet</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {euro(totalen.omzet)}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Totaal aantal</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {new Intl.NumberFormat("nl-NL").format(totalen.aantal)}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          {loading ? (
            <div className="p-6 text-sm text-slate-600">Gegevens laden...</div>
          ) : error ? (
            <div className="p-6 text-sm text-red-600">Fout: {error}</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">
              Geen gegevens gevonden voor {jaar}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-4 py-3 font-semibold">Datum</th>
                    <th className="px-4 py-3 font-semibold">Feestdag</th>
                    <th className="px-4 py-3 font-semibold">Omzet</th>
                    <th className="px-4 py-3 font-semibold">Aantal</th>
                    <th className="px-4 py-3 font-semibold">Weer</th>
                    <th className="px-4 py-3 font-semibold">Min °C</th>
                    <th className="px-4 py-3 font-semibold">Max °C</th>
                    <th className="px-4 py-3 font-semibold">Neerslag</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr
                      key={`${row.dag}-${row.naam}-${index}`}
                      className="border-t border-slate-200"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                        {formatDatum(row.dag || row.datum)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.feestdag || row.naam}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                        {euro(row.omzet)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                        {new Intl.NumberFormat("nl-NL").format(row.aantal ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-slate-800">
                        {row.weer_omschrijving || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                        {number1(row.temp_min)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                        {number1(row.temp_max)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                        {row.neerslag_mm == null ? "—" : `${number1(row.neerslag_mm)} mm`}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr className="border-t border-slate-200 font-semibold text-slate-900">
                    <td className="px-4 py-3" colSpan={2}>
                      Totaal
                    </td>
                    <td className="px-4 py-3">{euro(totalen.omzet)}</td>
                    <td className="px-4 py-3">
                      {new Intl.NumberFormat("nl-NL").format(totalen.aantal)}
                    </td>
                    <td className="px-4 py-3" colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}