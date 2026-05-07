"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";

type Row = {
  datum: string;
  dagnaam: string;
  omzet: number | string;
  is_feestdag: boolean;
  feestdag_namen: string | null;
};

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((res) => res.json());

function formatEuro(value: number | string) {
  return Number(value).toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function TopOmzetdagenPage() {
  const [limit, setLimit] = useState(25);

  const { data, error, isLoading } = useSWR(
    `/api/rapportage/top-omzetdagen?limit=${limit}`,
    fetcher,
    { revalidateOnMount: true }
  );

  const rows: Row[] = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows.map((row: Row) => ({
      ...row,
      omzet: Number(row.omzet),
    }));
  }, [data]);

  const totaalOmzet = rows.reduce((sum, row) => sum + Number(row.omzet), 0);
  const gemiddeldeOmzet =
    rows.length > 0 ? Math.round(totaalOmzet / rows.length) : 0;
  const feestdagAantal = rows.filter((r) => r.is_feestdag).length;
  const hoogsteDag = rows[0];

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700 shadow-sm">
          Fout bij laden van top omzetdagen.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
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
                Top omzetdagen
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Hoogste omzetdagen met feestdagmarkering uit de database.
              </p>
            </div>

            <div>
              <label
                htmlFor="limit"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Toon top
              </label>
              <select
                id="limit"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard
            titel="Hoogste dag"
            waarde={hoogsteDag ? formatEuro(hoogsteDag.omzet) : "-"}
            subwaarde={hoogsteDag ? formatDate(hoogsteDag.datum) : undefined}
            className="border-emerald-200 bg-emerald-50 text-emerald-900"
          />
          <KpiCard
            titel="Gemiddelde"
            waarde={formatEuro(gemiddeldeOmzet)}
            subwaarde={`over top ${rows.length}`}
          />
          <KpiCard
            titel="Feestdagen"
            waarde={String(feestdagAantal)}
            subwaarde="in deze selectie"
            className="border-amber-200 bg-amber-50 text-amber-900"
          />
          <KpiCard
            titel="Totaal selectie"
            waarde={formatEuro(totaalOmzet)}
            className="border-blue-200 bg-blue-50 text-blue-900"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">
              Ranglijst omzetdagen
            </h2>
          </div>

          {isLoading ? (
            <div className="p-6 text-sm text-slate-500">
              Bezig met laden...
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              Geen omzetdagen gevonden.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-right">#</th>
                    <th className="px-4 py-3 text-left">Datum</th>
                    <th className="px-4 py-3 text-left">Dag</th>
                    <th className="px-4 py-3 text-right">Omzet</th>
                    <th className="px-4 py-3 text-center">Feestdag</th>
                    <th className="px-4 py-3 text-left">Naam feestdag</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, index) => (
                    <tr
                      key={`${row.datum}-${index}`}
                      className={`border-t border-slate-200 transition hover:bg-slate-50 ${
                        row.is_feestdag ? "bg-amber-50/70" : "bg-white"
                      }`}
                    >
                      <td className="px-4 py-3 text-right font-bold text-slate-500">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {formatDate(row.datum)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.dagnaam}
                      </td>
                      <td className="px-4 py-3 text-right text-lg font-bold text-slate-900">
                        {formatEuro(row.omzet)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.is_feestdag ? (
                          <span className="rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                            Ja
                          </span>
                        ) : (
                          <span className="text-slate-400">Nee</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.feestdag_namen ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
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
      {subwaarde && (
        <p className="mt-1 text-sm font-medium opacity-80">{subwaarde}</p>
      )}
    </div>
  );
}