// src/app/admin/omzet/prognose/page.tsx
"use client";

import React, { useEffect, useState } from "react";
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

  const verschilMetVorigJaar =
    vorigJaarOmzet > 0 ? jaaromzet - vorigJaarOmzet : 0;

  const isHeaderLabel = (label: string) =>
    ["PROGNOSE", "REALISATIE", "TO-DO", "PROGNOSES", "LONEN"].includes(
      label.toUpperCase()
    );

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const sumRealisatieTmt = (maand: number) =>
    data
      .filter((x) => x.maand <= maand)
      .reduce((s, x) => s + (x.realisatieOmzet ?? 0), 0);

  const sumPrognoseNa = (maand: number) =>
    data
      .filter((x) => x.maand > maand)
      .reduce((s, x) => s + (x.prognoseOmzet ?? 0), 0);

  const projTodayForCurrentMonth = (() => {
    if (selectedYear !== currentYear) return null;

    const cur = data.find((x) => x.maand === currentMonth);
    const realizedUntilPrev = sumRealisatieTmt(currentMonth - 1);
    const realizedToDateThisMonth = cur?.realisatieOmzet ?? 0;
    const remainingDays = Math.max(
      0,
      (cur?.prognoseDagen ?? 0) - (cur?.realisatieDagen ?? 0)
    );
    const perDag = cur?.prognosePerDag ?? 0;
    const restOfThisMonth = remainingDays * perDag;
    const restOfYearAfterThisMonth = sumPrognoseNa(currentMonth);

    return (
      realizedUntilPrev +
      realizedToDateThisMonth +
      restOfThisMonth +
      restOfYearAfterThisMonth
    );
  })();

  const prognoseObvToDateByMonth = new Map<number, number | null>();

  for (const m of data) {
    let val: number | null = 0;

    if (selectedYear < currentYear) {
      val = sumRealisatieTmt(m.maand) + sumPrognoseNa(m.maand);
    } else if (selectedYear > currentYear) {
      val = null;
    } else {
      if (m.maand < currentMonth) {
        val = sumRealisatieTmt(m.maand) + sumPrognoseNa(m.maand);
      } else if (m.maand === currentMonth) {
        val = projTodayForCurrentMonth ?? null;
      } else {
        val = null;
      }
    }

    prognoseObvToDateByMonth.set(m.maand, val);
  }

  const rows: [string, (m: MaandData) => number | null][] = [
    ["PROGNOSE", () => null],
    ["omzet", (m) => m.prognoseOmzet],
    ["dagen", (m) => m.prognoseDagen],
    ["omzet/dag", (m) => m.prognosePerDag],
    ["REALISATIE", () => null],
    ["omzet", (m) => m.realisatieOmzet],
    ["dagen", (m) => m.realisatieDagen],
    ["omzet/dag", (m) => m.realisatiePerDag],
    ["voor/achter in dagen", (m) => m.voorAchterInDagen],
    ["TO-DO", () => null],
    ["omzet", (m) => m.todoOmzet],
    ["dagen", (m) => m.todoDagen],
    ["omzet/dag", (m) => m.todoPerDag],
    ["PROGNOSES", () => null],
    ["prognose obv huidig", (m) => m.prognoseHuidig],
    [
      "prognose obv omzet to date",
      (m) => prognoseObvToDateByMonth.get(m.maand) ?? null,
    ],
    ["LONEN", () => null],
    ["Loonkosten", (m) => Number(getLoonkosten(m.maand))],
    ["% van omzet", (m) => getLoonkostenPercentage(m.maand, m.realisatieOmzet)],
  ];

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
                Omzetprognose
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Prognose, realisatie, resterende omzet en loonkosten per maand.
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
            titel="Prognose jaaromzet"
            waarde={formatEuro(jaaromzet)}
            className="border-blue-200 bg-blue-50 text-blue-900"
          />
          <KpiCard
            titel="Realisatie tot nu"
            waarde={formatEuro(totalRealisatieOmzet)}
            subwaarde={`${omzetPercent}% van jaarprognose`}
            className="border-emerald-200 bg-emerald-50 text-emerald-900"
          />
          <KpiCard
            titel="Dagen gerealiseerd"
            waarde={`${totalRealisatieDagen} / ${totalPrognoseDagen}`}
            subwaarde={`${dagenPercent}% van geplande dagen`}
            className="border-slate-200 bg-white text-slate-900"
          />
          <KpiCard
            titel="Vorig jaar"
            waarde={vorigJaarOmzet > 0 ? formatEuro(vorigJaarOmzet) : "-"}
            subwaarde={
              vorigJaarOmzet > 0
                ? `${verschilMetVorigJaar >= 0 ? "+" : ""}${formatEuro(
                    verschilMetVorigJaar
                  )} verschil`
                : undefined
            }
            className={
              verschilMetVorigJaar >= 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900"
            }
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Maandoverzicht
              </h2>
              <p className="text-sm text-slate-500">
                Cijfers per maand met totalen aan de rechterzijde.
              </p>
            </div>

            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              Gedaan: {omzetPercent}% omzet in {dagenPercent}% van de dagen
            </div>
          </div>

          <div className="overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full border-collapse text-sm">
              <tbody>
                {rows.map(([label, fn], rowIdx) => (
                  <tr
                    key={`${label}-${rowIdx}`}
                    className={isHeaderLabel(label) ? "bg-slate-200" : ""}
                  >
                    <td
                      className={`sticky left-0 z-10 border-b border-slate-200 px-3 py-2 text-left whitespace-nowrap ${
                        isHeaderLabel(label)
                          ? "bg-slate-200 font-bold text-slate-900"
                          : "bg-white font-medium text-slate-700"
                      }`}
                    >
                      {label}
                    </td>

                    {data.map((m) => {
                      const raw = fn(m);
                      let display = "";

                      if (isHeaderLabel(label)) {
                        display = maandNamen[m.maand - 3];
                      } else if (raw === null) {
                        display = "";
                      } else if (label === "dagen") {
                        display = Math.round(raw).toLocaleString("nl-NL");
                      } else if (label === "voor/achter in dagen") {
                        display = raw.toLocaleString("nl-NL", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        });
                      } else if (label === "% van omzet") {
                        display = raw.toFixed(1) + "%";
                      } else {
                        display = formatNumber(raw);
                      }

                      let cellClass =
                        "border-b border-l border-slate-200 px-3 py-2 text-right font-mono text-slate-700";

                      if (isHeaderLabel(label)) {
                        cellClass =
                          "border-b border-l border-slate-300 bg-slate-200 px-3 py-2 text-right font-bold text-slate-900";
                      }

                      if (
                        label === "omzet/dag" &&
                        rowIdx === 7 &&
                        raw !== null
                      ) {
                        cellClass +=
                          raw > (m.prognosePerDag || 0)
                            ? " bg-emerald-50 text-emerald-800"
                            : " bg-red-50 text-red-800";
                      }

                      if (
                        label === "% van omzet" &&
                        raw !== null &&
                        raw > 25
                      ) {
                        cellClass += " bg-red-50 text-red-800";
                      }

                      if (label === "Loonkosten") {
                        const item = loonkosten.find(
                          (l) => l.maand === m.maand
                        );
                        const incompleet =
                          item &&
                          (Number(item.lonen) === 0 ||
                            Number(item.loonheffing) === 0 ||
                            Number(item.pensioenpremie) === 0);

                        if (incompleet) display += " 🔴";
                      }

                      return (
                        <td key={`${m.maand}-${label}-${rowIdx}`} className={cellClass}>
                          {display}
                        </td>
                      );
                    })}

                    <td className="border-b border-l border-slate-300 bg-slate-50 px-3 py-2 text-right font-bold text-slate-900">
                      {label === "omzet"
                        ? formatEuro(
                            data.reduce((sum, m) => sum + (fn(m) || 0), 0)
                          )
                        : label === "dagen"
                        ? data
                            .reduce((sum, m) => sum + (fn(m) || 0), 0)
                            .toLocaleString("nl-NL")
                        : label === "omzet/dag"
                        ? (() => {
                            let totOm = 0;
                            let totDg = 0;

                            if (rowIdx <= 3) {
                              totOm = data.reduce(
                                (s, m) => s + m.prognoseOmzet,
                                0
                              );
                              totDg = data.reduce(
                                (s, m) => s + m.prognoseDagen,
                                0
                              );
                            } else if (rowIdx <= 7) {
                              totOm = data.reduce(
                                (s, m) => s + m.realisatieOmzet,
                                0
                              );
                              totDg = data.reduce(
                                (s, m) => s + m.realisatieDagen,
                                0
                              );
                            } else if (rowIdx <= 12) {
                              totOm = data.reduce(
                                (s, m) => s + m.todoOmzet,
                                0
                              );
                              totDg = data.reduce((s, m) => s + m.todoDagen, 0);
                            } else return "";

                            return totDg > 0
                              ? formatNumber(Math.round(totOm / totDg))
                              : "";
                          })()
                        : label === "Loonkosten"
                        ? formatEuro(
                            data.reduce(
                              (sum, m) =>
                                sum + Number(getLoonkosten(m.maand)),
                              0
                            )
                          )
                        : label === "% van omzet"
                        ? (() => {
                            const totaalLoon = data.reduce(
                              (s, m) => s + getLoonkosten(m.maand),
                              0
                            );
                            const totaalOmzet = data.reduce(
                              (s, m) => s + m.realisatieOmzet,
                              0
                            );

                            return totaalOmzet > 0
                              ? ((totaalLoon / totaalOmzet) * 100).toFixed(1) +
                                  "%"
                              : "";
                          })()
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <strong className="text-slate-900">Status:</strong> gerealiseerd{" "}
            <strong>{omzetPercent}%</strong> van de omzet in{" "}
            <strong>{dagenPercent}%</strong> van de geplande dagen.
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
      {subwaarde && <p className="mt-1 text-sm font-medium opacity-80">{subwaarde}</p>}
    </div>
  );
}