"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

function formatEuro(value: string | number | null | undefined) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

function formatInt(value: string | number | null | undefined) {
  return new Intl.NumberFormat("nl-NL").format(Number(value ?? 0));
}

function formatDecimal(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number(value));
}

function formatDateParts(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { dag: iso, maand: "", weekdag: "" };
  }

  const dag = new Intl.DateTimeFormat("nl-NL", { day: "2-digit" }).format(d);
  const maand = new Intl.DateTimeFormat("nl-NL", { month: "short" })
    .format(d)
    .replace(".", "")
    .toUpperCase();
  const weekdag = new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
  })
    .format(d)
    .replace(".", "");

  return { dag, maand, weekdag };
}

function weerIcoon(omschrijving?: string | null) {
  switch ((omschrijving ?? "").toLowerCase()) {
    case "zonnig":
    case "overwegend zonnig":
      return "☀️";
    case "half bewolkt":
      return "⛅";
    case "bewolkt":
      return "☁️";
    case "mistig":
      return "🌫️";
    case "motregen":
    case "regenbuien":
      return "🌦️";
    case "regen":
    case "ijzelregen":
      return "🌧️";
    case "sneeuw":
    case "sneeuwbuien":
    case "sneeuwkorrels":
      return "❄️";
    case "onweer":
    case "onweer met hagel":
      return "⛈️";
    default:
      return "🌤️";
  }
}

export default function FeestdagOmzetPage() {
  const huidigJaar = new Date().getFullYear();

  const [jaar, setJaar] = useState(huidigJaar);
  const [rows, setRows] = useState<FeestdagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const jaren = useMemo(() => {
    const lijst: number[] = [];
    for (let y = huidigJaar; y >= 2024; y--) {
      lijst.push(y);
    }
    return lijst;
  }, [huidigJaar]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/rapportage/feestdagomzet?jaar=${jaar}`, {
          cache: "no-store",
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.detail || json?.error || "Onbekende fout");
        }

        if (!cancelled) {
          setRows(Array.isArray(json) ? json : []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setRows([]);
          setError(e?.message ?? "Fout bij laden");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [jaar]);

  const totalen = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.omzet += Number(row.omzet ?? 0);
        acc.aantal += Number(row.aantal ?? 0);
        acc.neerslag += Number(row.neerslag_mm ?? 0);
        return acc;
      },
      { omzet: 0, aantal: 0, neerslag: 0 }
    );
  }, [rows]);

  const gemiddeldeTemps = useMemo(() => {
    const metMin = rows.filter((r) => r.temp_min !== null && r.temp_min !== undefined);
    const metMax = rows.filter((r) => r.temp_max !== null && r.temp_max !== undefined);

    const avgMin =
      metMin.length > 0
        ? metMin.reduce((sum, r) => sum + Number(r.temp_min ?? 0), 0) / metMin.length
        : null;

    const avgMax =
      metMax.length > 0
        ? metMax.reduce((sum, r) => sum + Number(r.temp_max ?? 0), 0) / metMax.length
        : null;

    return { avgMin, avgMax };
  }, [rows]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href="/admin/rapportage/financieel"
              className="mb-3 inline-flex text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline"
            >
              ← Terug naar financieel
            </Link>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Feestdagenomzet
            </h1>
            <p className="mt-2 text-base text-slate-600">
              Omzet en bezoekers per feestdag inclusief historische weersituatie.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={jaar}
              onChange={(e) => setJaar(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm outline-none ring-0 transition focus:border-blue-400"
            >
              {jaren.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Feestdagen</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{rows.length}</div>
            <div className="mt-1 text-sm text-slate-500">in {jaar}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Totale omzet</div>
            <div className="mt-2 text-3xl font-bold text-emerald-700">
              {formatEuro(totalen.omzet)}
            </div>
            <div className="mt-1 text-sm text-slate-500">totaal</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Totaal aantal</div>
            <div className="mt-2 text-3xl font-bold text-violet-700">
              {formatInt(totalen.aantal)}
            </div>
            <div className="mt-1 text-sm text-slate-500">bezoekers</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Gem. temperatuur</div>
            <div className="mt-2 text-3xl font-bold text-orange-600">
              {gemiddeldeTemps.avgMin !== null && gemiddeldeTemps.avgMax !== null
                ? `${formatDecimal(gemiddeldeTemps.avgMin)}° / ${formatDecimal(
                    gemiddeldeTemps.avgMax
                  )}°`
                : "—"}
            </div>
            <div className="mt-1 text-sm text-slate-500">min / max</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Totale neerslag</div>
            <div className="mt-2 text-3xl font-bold text-sky-600">
              {formatDecimal(totalen.neerslag)} mm
            </div>
            <div className="mt-1 text-sm text-slate-500">totaal</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
            <div className="grid grid-cols-[130px_1.4fr_1fr_0.7fr_1fr_0.8fr_0.8fr_0.9fr] gap-4 text-sm font-semibold">
              <div>Datum</div>
              <div>Feestdag</div>
              <div>Omzet</div>
              <div>Aantal</div>
              <div>Weer</div>
              <div>Min °C</div>
              <div>Max °C</div>
              <div>Neerslag</div>
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-10 text-sm text-slate-500">Gegevens laden...</div>
          ) : error ? (
            <div className="px-6 py-10 text-sm text-red-600">Fout: {error}</div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-500">
              Geen gegevens gevonden.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {rows.map((row, index) => {
                const datumInfo = formatDateParts(row.dag || row.datum);

                return (
                  <div
                    key={`${row.dag}-${row.naam}-${index}`}
                    className="grid grid-cols-[130px_1.4fr_1fr_0.7fr_1fr_0.8fr_0.8fr_0.9fr] gap-4 px-6 py-5 transition hover:bg-slate-50"
                  >
                    <div>
                      <div className="inline-flex min-w-[72px] flex-col items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        <div className="w-full bg-blue-600 px-2 py-1 text-center text-xs font-bold tracking-wide text-white">
                          {datumInfo.maand}
                        </div>
                        <div className="px-2 pt-2 text-3xl font-bold leading-none text-slate-900">
                          {datumInfo.dag}
                        </div>
                        <div className="px-2 pb-2 pt-1 text-xs text-slate-500">
                          {datumInfo.weekdag}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col justify-center">
                      <div className="text-lg font-semibold text-slate-900">
                        {row.feestdag || row.naam}
                      </div>
                    </div>

                    <div className="flex flex-col justify-center">
                      <div className="text-2xl font-bold text-slate-900">
                        {formatEuro(row.omzet)}
                      </div>
                    </div>

                    <div className="flex flex-col justify-center">
                      <div className="text-2xl font-bold text-slate-900">
                        {formatInt(row.aantal)}
                      </div>
                    </div>

                    <div className="flex flex-col justify-center">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{weerIcoon(row.weer_omschrijving)}</span>
                        <div>
                          <div className="font-medium text-slate-900">
                            {row.weer_omschrijving || "—"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center text-2xl font-bold text-sky-600">
                      {row.temp_min == null ? "—" : `${formatDecimal(row.temp_min)}°`}
                    </div>

                    <div className="flex items-center text-2xl font-bold text-orange-500">
                      {row.temp_max == null ? "—" : `${formatDecimal(row.temp_max)}°`}
                    </div>

                    <div className="flex items-center text-xl font-semibold text-blue-600">
                      {row.neerslag_mm == null ? "—" : `${formatDecimal(row.neerslag_mm)} mm`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Weergegevens afkomstig van Open-Meteo (historisch). Temperaturen in °C,
          neerslag in mm.
        </div>
      </div>
    </main>
  );
}