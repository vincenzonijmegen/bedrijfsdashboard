// src/app/admin/omzet/prognose/page.tsx
"use client";

import React, { useEffect, useState } from "react";

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

export default function PrognosePage() {
  const [data, setData] = useState<MaandData[]>([]);
  const [jaaromzet, setJaaromzet] = useState<number>(0);

  useEffect(() => {
    fetch("/api/prognose/analyse")
      .then((res) => res.json())
      .then((res) => {
        setData(res.resultaten);
        setJaaromzet(res.jaaromzet);
      });
  }, []);

  const isHeaderLabel = (label: string) =>
    ["PROGNOSE", "REALISATIE", "TO-DO", "PROGNOSES"].includes(label.toUpperCase());

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
    ["prognose plusmin", (m) => m.plusmin],
    ["jaarprognose obv omzet tot vandaag", (m) => m.jrPrognoseObvTotNu],
    ["realisatie cumulatief", (m) => m.cumulatiefRealisatie],
  ];

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">Omzetprognose overzicht</h1>
      <p className="mb-4 text-gray-600">
        Prognose jaaromzet:&nbsp;
        <strong>
          € {jaaromzet.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
        </strong>
      </p>
      <div className="overflow-auto">
        <table className="table-auto border border-collapse w-full text-sm">
          <tbody>
            {rows.map(([label, fn], rowIdx) => (
              <tr
                key={label}
                className={isHeaderLabel(label) ? "bg-gray-200" : "border-t"}
              >
                <td
                  className={`px-2 py-1 text-left whitespace-nowrap ${
                    isHeaderLabel(label) ? "font-bold" : "font-medium"
                  }`}
                >
                  {label}
                </td>
                {data.map((m) => {
                  const raw = fn(m);
                  let display = "";
                  if (isHeaderLabel(label)) {
                    display = maandNamen[m.maand - 3];
                  } else if (label === "Prognose plusmin" && m.prognoseHuidig <= 0) {
                    display = "";
                  } else if (
                    raw === null ||
                    (raw === 0 && !(label === "omzet/dag" && rowIdx >= 11))
                  ) {
                    display = "";
                  } else {
                    // default numeric display
                    if (label === "dagen") {
                      display = Math.round(raw!).toLocaleString("nl-NL");
                    } else if (label === "voor/achter in dagen") {
                      display = raw!.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                    } else if (label.includes("%")) {
                      display = `${Math.round(raw! * 100)}%`;
                    } else {
                      display = raw!.toLocaleString("nl-NL", { maximumFractionDigits: 0 });
                    }
                  }
                  let cellClass = "px-2 py-1 text-right font-mono";
                  if (isHeaderLabel(label)) cellClass = "px-2 py-1 text-right font-bold";
                  if (label === "omzet/dag" && rowIdx === 7 && raw !== null) {
                    cellClass += raw > (m.prognosePerDag || 0)
                      ? " bg-green-100"
                      : " bg-red-100";
                  }
                  // kleur prognose plusmin cellen
                  if (label === "Prognose plusmin" && raw !== null) {
                    cellClass += raw > 0 ? " bg-green-100" : " bg-red-100";
                  }
                  return (
                    <td key={m.maand + label} className={cellClass}>
                      {display}
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-right font-bold">
                  {label === "omzet"
                    ? '€ ' +
                      data
                        .reduce((sum, m) => sum + (fn(m) || 0), 0)
                        .toLocaleString("nl-NL", { maximumFractionDigits: 0 })
                    : label === "dagen"
                    ? data
                        .reduce((sum, m) => sum + (fn(m) || 0), 0)
                        .toLocaleString("nl-NL")
                    : label === "omzet/dag"
                    ? (() => {
                        let totOm = 0;
                        let totDg = 0;
                        if (rowIdx <= 3) {
                          totOm = data.reduce((s, m) => s + m.prognoseOmzet, 0);
                          totDg = data.reduce((s, m) => s + m.prognoseDagen, 0);
                        } else if (rowIdx <= 7) {
                          totOm = data.reduce((s, m) => s + m.realisatieOmzet, 0);
                          totDg = data.reduce((s, m) => s + m.realisatieDagen, 0);
                        } else if (rowIdx <= 12) {
                          totOm = data.reduce((s, m) => s + m.todoOmzet, 0);
                          totDg = data.reduce((s, m) => s + m.todoDagen, 0);
                        } else {
                          return "";
                        }
                        return totDg > 0
                          ? Math.round(totOm / totDg).toLocaleString("nl-NL")
                          : "";
                      })()
                    : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
