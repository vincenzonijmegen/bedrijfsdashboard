// src/app/admin/omzet/prognose/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const maandNamen = [
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
];

interface MaandData {
  maand: number;
  prognoseOmzet: number;
  prognoseDagen: number;
  prognosePerDag: number;
  realisatieOmzet: number;
  realisatieDagen: number;
  realisatiePerDag: number | null;
  todoOmzet: number;
  todoDagen: number;
  todoPerDag: number | null;
  prognoseHuidig: number;
  plusmin: number;
  cumulatiefPlus: number;
  cumulatiefPrognose: number;
  cumulatiefRealisatie: number;
  voorAchterInDagen: number | null;
  procentueel: number | null;
  jrPrognoseObvTotNu: number;
}

interface LoonkostenItem {
  jaar: number;
  maand: number;
  lonen: number;
  loonheffing: number;
  pensioenpremie: number;
}

const thisYear = new Date().getFullYear();
const years = Array.from(
  { length: thisYear - 2022 + 1 },
  (_, i) => thisYear - i
);

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

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

export default function PrognosePage() {
  const [selectedYear, setSelectedYear] = useState<number>(thisYear);
  const [data, setData] = useState<MaandData[]>([]);
  const [jaaromzet, setJaaromzet] = useState<number>(0);
  const [vorigJaarOmzet, setVorigJaarOmzet] = useState<number>(0);
  const [loonkosten, setLoonkosten] = useState<LoonkostenItem[]>([]);

  useEffect(() => {
    fetch(`/api/prognose/analyse?jaar=${selectedYear}`)
      .then((res) => res.json())
      .then((res) => {
        setData(res.resultaten ?? []);
        setJaaromzet(Number(res.jaaromzet ?? 0));
        setVorigJaarOmzet(
          typeof res.vorigJaarOmzet === "number" ? res.vorigJaarOmzet : 0
        );
      });

    fetch(`/api/rapportage/loonkosten?jaar=${selectedYear}`)
      .then((res) => res.json())
      .then((res) => {
        const src = Array.isArray(res?.maanden)
          ? res.maanden
          : Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
          ? res.data
          : [];

        const clean = (src as any[]).map((x) => ({
          jaar: Number(x.jaar ?? selectedYear),
          maand: Number(x.maand ?? 0),
          lonen: Number(x.lonen ?? 0),
          loonheffing: Number(x.loonheffing ?? 0),
          pensioenpremie: Number(x.pensioenpremie ?? 0),
        }));

        setLoonkosten(clean);
      })
      .catch(() => setLoonkosten([]));
  }, [selectedYear]);

  const getLoonkosten = (maand: number) => {
    const item = loonkosten.find((l) => Number(l.maand) === Number(maand));
    if (!item) return 0;

    return (
      Number(item.lonen) +
      Number(item.loonheffing) +
      Number(item.pensioenpremie)
    );
  };

  const getLoonkostenPercentage = (maand: number, omzet: number) => {
    const totaal = getLoonkosten(maand);
    return omzet > 0 ? (totaal / omzet) * 100 : 0;
  };

  const totalRealisatieOmzet = data.reduce(
    (sum, m) => sum + m.realisatieOmzet,
    0
  );
  const totalRealisatieDagen = data.reduce(
    (sum, m) => sum + m.realisatieDagen,
    0
  );
  const totalPrognoseDagen = data.reduce(
    (sum, m) => sum + m.prognoseDagen,
    0
  );

  const omzetPercent =
    jaaromzet > 0 ? Math.round((totalRealisatieOmzet / jaaromzet) * 100) : 0;
  const dagenPercent =
    totalPrognoseDagen > 0
      ? Math.round((totalRealisatieDagen / totalPrognoseDagen) * 100)
      : 0;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const getVerwachteMaanduitkomst = (m: MaandData) => {
    if (selectedYear < currentYear) return m.realisatieOmzet;
    if (selectedYear > currentYear) return m.prognoseOmzet;
    if (m.maand < currentMonth) return m.realisatieOmzet;
    if (m.maand > currentMonth) return m.prognoseOmzet;

    const resterendeDagen = Math.max(
      0,
      (m.prognoseDagen ?? 0) - (m.realisatieDagen ?? 0)
    );

    return (
      (m.realisatieOmzet ?? 0) +
      resterendeDagen * (m.prognosePerDag ?? 0)
    );
  };

  const verwachteJaaromzet = useMemo(
    () => data.reduce((som, m) => som + getVerwachteMaanduitkomst(m), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, selectedYear, currentYear, currentMonth]
  );

  const verschilVorigJaar =
    vorigJaarOmzet > 0 ? verwachteJaaromzet - vorigJaarOmzet : 0;
  const verschilVorigJaarPct =
    vorigJaarOmzet > 0 ? (verschilVorigJaar / vorigJaarOmzet) * 100 : 0;

  const sumRealisatieTmt = (maand: number) =>
    data
      .filter((x) => x.maand <= maand)
      .reduce((s, x) => s + (x.realisatieOmzet ?? 0), 0);

  const sumPrognoseNa = (maand: number) =>
    data
      .filter((x) => x.maand > maand)
      .reduce((s, x) => s + (x.prognoseOmzet ?? 0), 0);

  const prognoseObvToDateByMonth = new Map<number, number | null>();

  for (const m of data) {
    let val: number | null = null;

    if (selectedYear < currentYear) {
      val = sumRealisatieTmt(m.maand) + sumPrognoseNa(m.maand);
    } else if (selectedYear === currentYear) {
      if (m.maand < currentMonth) {
        val = sumRealisatieTmt(m.maand) + sumPrognoseNa(m.maand);
      } else if (m.maand === currentMonth) {
        const gerealiseerdTotVorigeMaand = sumRealisatieTmt(currentMonth - 1);
        val =
          gerealiseerdTotVorigeMaand +
          getVerwachteMaanduitkomst(m) +
          sumPrognoseNa(currentMonth);
      }
    }

    prognoseObvToDateByMonth.set(m.maand, val);
  }

  const totalLoonkosten = data.reduce(
    (sum, m) => sum + Number(getLoonkosten(m.maand)),
    0
  );
  const totaalLoonPct =
    totalRealisatieOmzet > 0
      ? (totalLoonkosten / totalRealisatieOmzet) * 100
      : 0;

  type Row = {
    label: string;
    section?: boolean;
    value?: (m: MaandData) => number | null;
    format?: "number" | "euro" | "percentage" | "decimal";
    total?: () => string;
    tone?: (m: MaandData, raw: number | null) => string;
  };

  const rows: Row[] = [
    { label: "OMZET", section: true },
    {
      label: "Prognose",
      value: (m) => m.prognoseOmzet,
      format: "number",
      total: () => formatEuro(jaaromzet),
    },
    {
      label: "Realisatie",
      value: (m) => m.realisatieOmzet,
      format: "number",
      total: () => formatEuro(totalRealisatieOmzet),
    },
    {
      label: "Verschil €",
      value: (m) => m.realisatieOmzet - m.prognoseOmzet,
      format: "number",
      tone: (_m, raw) =>
        raw === null || raw === 0
          ? ""
          : raw > 0
          ? " bg-emerald-50 text-emerald-800"
          : " bg-red-50 text-red-800",
      total: () => formatEuro(totalRealisatieOmzet - jaaromzet),
    },
    {
      label: "Verschil %",
      value: (m) =>
        m.prognoseOmzet > 0
          ? ((m.realisatieOmzet - m.prognoseOmzet) / m.prognoseOmzet) * 100
          : null,
      format: "percentage",
      tone: (_m, raw) =>
        raw === null || raw === 0
          ? ""
          : raw > 0
          ? " bg-emerald-50 text-emerald-800"
          : " bg-red-50 text-red-800",
      total: () =>
        jaaromzet > 0
          ? formatPercentage(
              ((totalRealisatieOmzet - jaaromzet) / jaaromzet) * 100
            )
          : "",
    },
    {
      label: "Verwachte maanduitkomst",
      value: (m) => getVerwachteMaanduitkomst(m),
      format: "number",
      tone: (m, raw) => {
        if (raw === null || m.prognoseOmzet <= 0) return "";
        if (m.maand !== currentMonth || selectedYear !== currentYear) return "";
        return raw >= m.prognoseOmzet
          ? " bg-emerald-50 text-emerald-800 font-semibold"
          : " bg-amber-50 text-amber-900 font-semibold";
      },
      total: () => formatEuro(verwachteJaaromzet),
    },
    { label: "DAGEN & TEMPO", section: true },
    {
      label: "Geplande dagen",
      value: (m) => m.prognoseDagen,
      format: "number",
      total: () => totalPrognoseDagen.toLocaleString("nl-NL"),
    },
    {
      label: "Gerealiseerde dagen",
      value: (m) => m.realisatieDagen,
      format: "number",
      total: () => totalRealisatieDagen.toLocaleString("nl-NL"),
    },
    {
      label: "Resterende dagen",
      value: (m) => Math.max(0, m.prognoseDagen - m.realisatieDagen),
      format: "number",
      total: () =>
        Math.max(0, totalPrognoseDagen - totalRealisatieDagen).toLocaleString(
          "nl-NL"
        ),
    },
    {
      label: "Prognose omzet/dag",
      value: (m) => m.prognosePerDag,
      format: "number",
      total: () =>
        totalPrognoseDagen > 0
          ? formatNumber(Math.round(jaaromzet / totalPrognoseDagen))
          : "",
    },
    {
      label: "Werkelijke omzet/dag",
      value: (m) => m.realisatiePerDag,
      format: "number",
      tone: (m, raw) =>
        raw === null
          ? ""
          : raw >= (m.prognosePerDag || 0)
          ? " bg-emerald-50 text-emerald-800"
          : " bg-red-50 text-red-800",
      total: () =>
        totalRealisatieDagen > 0
          ? formatNumber(
              Math.round(totalRealisatieOmzet / totalRealisatieDagen)
            )
          : "",
    },
    {
      label: "Voor/achter in dagen",
      value: (m) => m.voorAchterInDagen,
      format: "decimal",
      tone: (_m, raw) =>
        raw === null || raw === 0
          ? ""
          : raw > 0
          ? " text-emerald-800"
          : " text-red-800",
    },
    { label: "LOONKOSTEN", section: true },
    {
      label: "Loonkosten",
      value: (m) => Number(getLoonkosten(m.maand)),
      format: "number",
      total: () => formatEuro(totalLoonkosten),
    },
    {
      label: "% van omzet",
      value: (m) => getLoonkostenPercentage(m.maand, m.realisatieOmzet),
      format: "percentage",
      tone: (_m, raw) =>
        raw !== null && raw > 25 ? " bg-red-50 text-red-800" : "",
      total: () => formatPercentage(totaalLoonPct),
    },
  ];

  const renderCellValue = (row: Row, raw: number | null) => {
    if (raw === null) return "";
    if (row.format === "percentage") return formatPercentage(raw);
    if (row.format === "decimal") {
      return raw.toLocaleString("nl-NL", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
    }
    if (row.format === "euro") return formatEuro(raw);
    return formatNumber(raw);
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Link
            href="/admin/rapportage"
            className="text-sm text-blue-700 hover:underline"
          >
            ← Terug naar rapportages
          </Link>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Omzetprognose
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Prognose, realisatie, tempo en loonkosten per maand.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Jaar
              </label>
              <select
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard
            titel="Jaarprognose"
            waarde={formatEuro(jaaromzet)}
            className="border-blue-200 bg-blue-50 text-blue-900"
          />
          <KpiCard
            titel="Verwachte jaaromzet nu"
            waarde={formatEuro(verwachteJaaromzet)}
            subwaarde={
              jaaromzet > 0
                ? `${
                    verwachteJaaromzet - jaaromzet >= 0 ? "+" : ""
                  }${formatEuro(verwachteJaaromzet - jaaromzet)} t.o.v. prognose`
                : undefined
            }
            className="border-violet-200 bg-violet-50 text-violet-900"
          />
          <KpiCard
            titel="Realisatie t/m vandaag"
            waarde={formatEuro(totalRealisatieOmzet)}
            subwaarde={`${omzetPercent}% van jaarprognose`}
            className="border-emerald-200 bg-emerald-50 text-emerald-900"
          />
          <KpiCard
            titel="Verschil t.o.v. vorig jaar"
            waarde={
              vorigJaarOmzet > 0
                ? `${verschilVorigJaar >= 0 ? "+" : ""}${formatEuro(
                    verschilVorigJaar
                  )}`
                : "-"
            }
            subwaarde={
              vorigJaarOmzet > 0
                ? `${verschilVorigJaarPct >= 0 ? "+" : ""}${verschilVorigJaarPct.toFixed(
                    1
                  )}%`
                : undefined
            }
            className={
              verschilVorigJaar >= 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900"
            }
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Maandoverzicht</h2>
              <p className="text-sm text-slate-500">
                Omzet, tempo en loonkosten per maand. De huidige maand is gemarkeerd.
              </p>
            </div>

            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              {totalRealisatieDagen} van {totalPrognoseDagen} dagen gerealiseerd
            </div>
          </div>

          <div className="overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full border-collapse text-sm">
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr
                    key={`${row.label}-${rowIdx}`}
                    className={row.section ? "bg-slate-200" : ""}
                  >
                    <td
                      className={`sticky left-0 z-10 border-b border-slate-200 px-3 py-2 text-left whitespace-nowrap ${
                        row.section
                          ? "bg-slate-200 font-bold text-slate-900"
                          : "bg-white font-medium text-slate-700"
                      }`}
                    >
                      {row.label}
                    </td>

                    {data.map((m) => {
                      const isCurrent =
                        selectedYear === currentYear && m.maand === currentMonth;
                      const isFuture =
                        selectedYear > currentYear ||
                        (selectedYear === currentYear && m.maand > currentMonth);

                      if (row.section) {
                        return (
                          <td
                            key={`${m.maand}-${row.label}-${rowIdx}`}
                            className={`border-b border-l border-slate-300 px-3 py-2 text-right font-bold text-slate-900 ${
                              isCurrent
                                ? "bg-blue-100"
                                : isFuture
                                ? "bg-slate-100 text-slate-500"
                                : "bg-slate-200"
                            }`}
                          >
                            {maandNamen[m.maand - 3]}
                          </td>
                        );
                      }

                      const raw = row.value ? row.value(m) : null;
                      let display = renderCellValue(row, raw);

                      if (row.label === "Loonkosten") {
                        const item = loonkosten.find((l) => l.maand === m.maand);
                        const incompleet =
                          item &&
                          (Number(item.lonen) === 0 ||
                            Number(item.loonheffing) === 0 ||
                            Number(item.pensioenpremie) === 0);

                        if (incompleet) display += " 🔴";
                      }

                      const tone = row.tone ? row.tone(m, raw) : "";

                      return (
                        <td
                          key={`${m.maand}-${row.label}-${rowIdx}`}
                          className={`border-b border-l border-slate-200 px-3 py-2 text-right font-mono ${
                            isCurrent
                              ? "bg-blue-50/70"
                              : isFuture
                              ? "bg-slate-50 text-slate-400"
                              : "text-slate-700"
                          }${tone}`}
                        >
                          {display}
                        </td>
                      );
                    })}

                    <td
                      className={`border-b border-l border-slate-300 px-3 py-2 text-right font-bold ${
                        row.section
                          ? "bg-slate-200 text-slate-900"
                          : "bg-slate-50 text-slate-900"
                      }`}
                    >
                      {row.section ? "" : row.total?.() ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <strong className="text-slate-900">Status:</strong>{" "}
            {totalRealisatieDagen} van {totalPrognoseDagen} dagen gerealiseerd ·{" "}
            <strong>{omzetPercent}%</strong> van de jaarprognose gerealiseerd ·{" "}
            verwachte jaaromzet <strong>{formatEuro(verwachteJaaromzet)}</strong>.
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              Ontwikkeling verwachte jaaromzet
            </h2>
            <p className="text-sm text-slate-500">
              Verwachte eindomzet op basis van de stand na iedere maand.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
            {data.map((m) => {
              const waarde = prognoseObvToDateByMonth.get(m.maand) ?? null;
              const isCurrent =
                selectedYear === currentYear && m.maand === currentMonth;

              return (
                <div
                  key={m.maand}
                  className={`rounded-xl border p-3 ${
                    isCurrent
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {maandNamen[m.maand - 3]}
                  </div>
                  <div className="mt-1 text-base font-bold text-slate-900">
                    {waarde === null ? "-" : formatEuro(waarde)}
                  </div>
                </div>
              );
            })}
          </div>
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
      {subwaarde && (
        <p className="mt-1 text-sm font-medium opacity-80">{subwaarde}</p>
      )}
    </div>
  );
}
