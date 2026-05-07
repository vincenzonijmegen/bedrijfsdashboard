// ===========================
// File: src/app/admin/rapportage/maandomzet/page.tsx
// ===========================
"use client";

import Link from "next/link";
import { useEffect } from "react";
import useSWR, { mutate } from "swr";

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((res) => res.json());

interface Row {
  jaar: number;
  maand_start: string;
  totaal: number;
}

const maandnamenMap: Record<number, string> = {
  1: "januari",
  2: "februari",
  3: "maart",
  4: "april",
  5: "mei",
  6: "juni",
  7: "juli",
  8: "augustus",
  9: "september",
  10: "oktober",
  11: "november",
  12: "december",
};

function formatEuro(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return value.toLocaleString("nl-NL", { maximumFractionDigits: 0 });
}

export default function MaandomzetPage() {
  useEffect(() => {
    mutate("/api/rapportage/maandomzet");
  }, []);

  const { data, error } = useSWR("/api/rapportage/maandomzet", fetcher, {
    revalidateOnMount: true,
  });

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700 shadow-sm">
          Fout bij laden van maandomzet.
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          Bezig met laden...
        </div>
      </div>
    );
  }

  const rawRows = Array.isArray((data as any).rows)
    ? ((data as any).rows as Row[])
    : [];

  const parsedRows: Row[] = rawRows.map((r) => ({
    jaar: Number((r as any).jaar),
    maand_start: String((r as any).maand_start),
    totaal: Number((r as any).totaal),
  }));

  const maxDatum = (data as any).max_datum
    ? new Date((data as any).max_datum)
    : null;

  const alleMaanden = Array.from(
    new Set(parsedRows.map((r) => new Date(r.maand_start).getMonth() + 1))
  )
    .sort((a, b) => a - b)
    .map((m) => maandnamenMap[m]);

  const jaren = Array.from(new Set(parsedRows.map((r) => r.jaar))).sort(
    (a, b) => a - b
  ) as number[];

  const perMaand: Record<string, Record<number, number>> = {};
  const alleWaarden: number[] = [];

  parsedRows.forEach(({ jaar, maand_start, totaal }) => {
    const mIndex = new Date(maand_start).getMonth() + 1;
    const maand = maandnamenMap[mIndex];

    perMaand[maand] = perMaand[maand] || {};
    perMaand[maand][jaar] = totaal;
    alleWaarden.push(totaal);
  });

  const min = Math.min(...alleWaarden);
  const max = Math.max(...alleWaarden);

  const getColorStyle = (value: number) => {
    if (!isFinite(min) || !isFinite(max) || max === min) return {};
    if (value <= 0) return {};

    const pct = (value - min) / (max - min);
    const opacity = 0.08 + pct * 0.28;

    return {
      backgroundColor: `rgba(37, 99, 235, ${opacity})`,
      fontWeight: 700,
    } as React.CSSProperties;
  };

  const totaalAlleJaren = parsedRows.reduce((sum, r) => sum + r.totaal, 0);
  const laatsteJaar = jaren.at(-1);
  const laatsteJaarTotaal = laatsteJaar
    ? parsedRows
        .filter((r) => r.jaar === laatsteJaar)
        .reduce((sum, r) => sum + r.totaal, 0)
    : 0;

  const besteMaand = parsedRows.length
    ? parsedRows.reduce((beste, r) => (r.totaal > beste.totaal ? r : beste))
    : null;

  const gemiddeldePerMaand =
    parsedRows.length > 0 ? Math.round(totaalAlleJaren / parsedRows.length) : 0;

  if (parsedRows.length === 0) {
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

            <div className="mt-3">
              <h1 className="text-2xl font-bold text-slate-900">
                Maandomzet per jaar
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {maxDatum
                  ? `Huidige jaar bijgewerkt t/m ${maxDatum.toLocaleDateString(
                      "nl-NL",
                      {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }
                    )}`
                  : "Nog geen gegevens beschikbaar."}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-600 shadow-sm">
            Er zijn nog geen maandomzetgegevens om te tonen. Probeer eerst een
            import uit te voeren.
          </div>
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

          <div className="mt-3">
            <h1 className="text-2xl font-bold text-slate-900">
              Maandomzet per jaar
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Omzet per maand vergeleken over alle beschikbare jaren.
              {maxDatum && (
                <>
                  {" "}
                  Huidige jaar bijgewerkt t/m{" "}
                  <strong className="text-slate-700">
                    {maxDatum.toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </strong>
                  .
                </>
              )}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard
            titel="Laatste jaar"
            waarde={laatsteJaar ? String(laatsteJaar) : "-"}
            subwaarde={formatEuro(laatsteJaarTotaal)}
            className="border-blue-200 bg-blue-50 text-blue-900"
          />

          <KpiCard
            titel="Aantal jaren"
            waarde={String(jaren.length)}
            subwaarde={`${alleMaanden.length} maanden in overzicht`}
          />

          <KpiCard
            titel="Gemiddelde maand"
            waarde={formatEuro(gemiddeldePerMaand)}
            className="border-emerald-200 bg-emerald-50 text-emerald-900"
          />

          <KpiCard
            titel="Beste maand"
            waarde={besteMaand ? formatEuro(besteMaand.totaal) : "-"}
            subwaarde={
              besteMaand
                ? `${maandnamenMap[
                    new Date(besteMaand.maand_start).getMonth() + 1
                  ]} ${besteMaand.jaar}`
                : undefined
            }
            className="border-orange-200 bg-orange-50 text-orange-900"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Maandomzetmatrix
              </h2>
              <p className="text-sm text-slate-500">
                Donkerdere cellen geven hogere omzet aan binnen het volledige
                overzicht.
              </p>
            </div>

            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              Totaal: {formatEuro(totaalAlleJaren)}
            </div>
          </div>

          <div className="overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-200">
                  <th className="sticky left-0 z-10 border-b border-slate-300 bg-slate-200 px-3 py-2 text-left">
                    Maand
                  </th>

                  {jaren.map((j) => (
                    <th
                      key={j}
                      className="border-b border-l border-slate-300 px-3 py-2 text-right"
                    >
                      {j}
                    </th>
                  ))}

                  <th className="border-b border-l border-slate-300 bg-slate-100 px-3 py-2 text-right">
                    Gem.
                  </th>
                </tr>
              </thead>

              <tbody>
                {alleMaanden.map((maand) => {
                  const vals = jaren.map((j) => perMaand[maand]?.[j] || 0);
                  const avgRow =
                    vals.length > 0
                      ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
                      : 0;

                  return (
                    <tr key={maand} className="border-b border-slate-200">
                      <td className="sticky left-0 z-10 bg-white px-3 py-2 font-semibold capitalize text-slate-800">
                        {maand}
                      </td>

                      {jaren.map((j) => {
                        const val = perMaand[maand]?.[j] || 0;
                        const style = getColorStyle(val);

                        return (
                          <td
                            key={j}
                            className="border-l border-slate-200 px-3 py-2 text-right font-mono text-slate-800"
                            style={style}
                          >
                            {val > 0 ? formatNumber(val) : "-"}
                          </td>
                        );
                      })}

                      <td className="border-l border-slate-300 bg-slate-50 px-3 py-2 text-right font-bold text-slate-900">
                        {formatNumber(avgRow)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="bg-slate-200 font-bold text-slate-900">
                  <td className="sticky left-0 z-10 border-t border-slate-300 bg-slate-200 px-3 py-2">
                    Totaal per jaar
                  </td>

                  {jaren.map((j) => (
                    <td
                      key={`totaal-${j}`}
                      className="border-l border-t border-slate-300 px-3 py-2 text-right"
                    >
                      {formatNumber(
                        parsedRows
                          .filter((r) => r.jaar === j)
                          .reduce((sum, r) => sum + r.totaal, 0)
                      )}
                    </td>
                  ))}

                  <td className="border-l border-t border-slate-300 bg-slate-100 px-3 py-2 text-right">
                    {formatNumber(totaalAlleJaren)}
                  </td>
                </tr>

                <tr className="bg-slate-100 font-semibold text-slate-800">
                  <td className="sticky left-0 z-10 border-t border-slate-300 bg-slate-100 px-3 py-2">
                    Gemiddelde per maand
                  </td>

                  {jaren.map((j) => {
                    const total = parsedRows
                      .filter((r) => r.jaar === j)
                      .reduce((sum, r) => sum + r.totaal, 0);
                    const avg =
                      alleMaanden.length > 0
                        ? Math.round(total / alleMaanden.length)
                        : 0;

                    return (
                      <td
                        key={`gem-${j}`}
                        className="border-l border-t border-slate-300 px-3 py-2 text-right"
                      >
                        {formatNumber(avg)}
                      </td>
                    );
                  })}

                  <td className="border-l border-t border-slate-300 bg-slate-50 px-3 py-2 text-right">
                    {formatNumber(gemiddeldePerMaand)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
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