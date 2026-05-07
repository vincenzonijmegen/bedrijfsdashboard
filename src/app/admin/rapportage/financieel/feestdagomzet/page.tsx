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
    maximumFractionDigits: 0,
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
  if (Number.isNaN(d.getTime())) return { dag: iso, maand: "", weekdag: "" };

  return {
    dag: new Intl.DateTimeFormat("nl-NL", { day: "2-digit" }).format(d),
    maand: new Intl.DateTimeFormat("nl-NL", { month: "short" })
      .format(d)
      .replace(".", "")
      .toUpperCase(),
    weekdag: new Intl.DateTimeFormat("nl-NL", { weekday: "short" })
      .format(d)
      .replace(".", ""),
  };
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
    for (let y = huidigJaar; y >= 2024; y--) lijst.push(y);
    return lijst;
  }, [huidigJaar]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    async function load() {
      try {
        setLoading(true);
        setError(null);
        setRows([]);

        const res = await fetch(`/api/rapportage/feestdagomzet?jaar=${jaar}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.detail || json?.error || "Onbekende fout");
        }

        setRows(Array.isArray(json) ? json : []);
      } catch (e: any) {
        if (e?.name === "AbortError") {
          setError("Laden duurt te lang. Mogelijk loopt de API vast op dit jaar.");
        } else {
          setError(e?.message ?? "Fout bij laden");
        }
        setRows([]);
      } finally {
        window.clearTimeout(timeout);
        setLoading(false);
      }
    }

    load();

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
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

    return {
      avgMin: metMin.length
        ? metMin.reduce((sum, r) => sum + Number(r.temp_min ?? 0), 0) / metMin.length
        : null,
      avgMax: metMax.length
        ? metMax.reduce((sum, r) => sum + Number(r.temp_max ?? 0), 0) / metMax.length
        : null,
    };
  }, [rows]);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Link
            href="/admin/rapportage/financieel"
            className="text-sm text-blue-700 hover:underline"
          >
            ← Terug naar financiële rapportages
          </Link>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Feestdagenomzet
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Omzet en bezoekers per feestdag inclusief historische weersituatie.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Jaar
              </label>
              <select
                value={jaar}
                onChange={(e) => setJaar(Number(e.target.value))}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                {jaren.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <KpiCard titel="Feestdagen" waarde={String(rows.length)} subwaarde={`in ${jaar}`} />
          <KpiCard
            titel="Totale omzet"
            waarde={formatEuro(totalen.omzet)}
            className="border-emerald-200 bg-emerald-50 text-emerald-900"
          />
          <KpiCard
            titel="Totaal aantal"
            waarde={formatInt(totalen.aantal)}
            subwaarde="bezoekers"
            className="border-violet-200 bg-violet-50 text-violet-900"
          />
          <KpiCard
            titel="Gem. temperatuur"
            waarde={
              gemiddeldeTemps.avgMin !== null && gemiddeldeTemps.avgMax !== null
                ? `${formatDecimal(gemiddeldeTemps.avgMin)}° / ${formatDecimal(
                    gemiddeldeTemps.avgMax
                  )}°`
                : "—"
            }
            subwaarde="min / max"
            className="border-orange-200 bg-orange-50 text-orange-900"
          />
          <KpiCard
            titel="Totale neerslag"
            waarde={`${formatDecimal(totalen.neerslag)} mm`}
            className="border-sky-200 bg-sky-50 text-sky-900"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">
              Overzicht feestdagen
            </h2>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-slate-500">Gegevens laden...</div>
          ) : error ? (
            <div className="p-6 text-sm text-red-700">{error}</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              Geen gegevens gevonden.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left">Datum</th>
                    <th className="px-4 py-3 text-left">Feestdag</th>
                    <th className="px-4 py-3 text-right">Omzet</th>
                    <th className="px-4 py-3 text-right">Aantal</th>
                    <th className="px-4 py-3 text-left">Weer</th>
                    <th className="px-4 py-3 text-right">Min °C</th>
                    <th className="px-4 py-3 text-right">Max °C</th>
                    <th className="px-4 py-3 text-right">Neerslag</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, index) => {
                    const datumInfo = formatDateParts(row.dag || row.datum);

                    return (
                      <tr
                        key={`${row.dag}-${row.naam}-${index}`}
                        className="border-t border-slate-200 hover:bg-slate-50"
                      >
                        <td className="px-4 py-3">
                          <div className="inline-flex min-w-[68px] flex-col items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                            <div className="w-full bg-blue-600 px-2 py-1 text-center text-[11px] font-bold tracking-wide text-white">
                              {datumInfo.maand}
                            </div>
                            <div className="px-2 pt-2 text-xl font-bold leading-none text-slate-900">
                              {datumInfo.dag}
                            </div>
                            <div className="px-2 pb-2 pt-1 text-[11px] text-slate-500">
                              {datumInfo.weekdag}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {row.feestdag || row.naam}
                        </td>

                        <td className="px-4 py-3 text-right text-lg font-bold text-slate-900">
                          {formatEuro(row.omzet)}
                        </td>

                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {formatInt(row.aantal)}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{weerIcoon(row.weer_omschrijving)}</span>
                            <span className="text-slate-700">
                              {row.weer_omschrijving || "—"}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right font-semibold text-sky-600">
                          {row.temp_min == null ? "—" : `${formatDecimal(row.temp_min)}°`}
                        </td>

                        <td className="px-4 py-3 text-right font-semibold text-orange-600">
                          {row.temp_max == null ? "—" : `${formatDecimal(row.temp_max)}°`}
                        </td>

                        <td className="px-4 py-3 text-right font-semibold text-blue-600">
                          {row.neerslag_mm == null
                            ? "—"
                            : `${formatDecimal(row.neerslag_mm)} mm`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          Weergegevens afkomstig van Open-Meteo. Temperaturen in °C, neerslag in mm.
        </div>
      </div>
    </main>
  );
}

function KpiCard({
  titel,
  waarde,
  subwaarde,
  className = "",
}: {
  titel: string;
  waarde: string;
  subwaarde?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        className || "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <p className="text-sm font-medium opacity-70">{titel}</p>
      <p className="mt-2 text-2xl font-bold">{waarde}</p>
      {subwaarde && <p className="mt-1 text-sm font-medium opacity-80">{subwaarde}</p>}
    </div>
  );
}