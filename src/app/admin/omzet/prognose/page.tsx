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
  const [vorigJaarOmzet, setVorigJaarOmzet] = useState<number>(0);

  useEffect(() => {
    fetch("/api/prognose/analyse")
      .then((res) => res.json())
      .then((res) => {
        setData(res.resultaten);
        setJaaromzet(res.jaaromzet);
        // Gebruik vorigJaarOmzet afkomstig van dezelfde API
        if (typeof res.vorigJaarOmzet === 'number') {
          setVorigJaarOmzet(res.vorigJaarOmzet);
        }
      });
  }, []);

  // Samenvatting percentages
  const totalRealisatieOmzet = data.reduce((sum, m) => sum + m.realisatieOmzet, 0);
  const totalRealisatieDagen = data.reduce((sum, m) => sum + m.realisatieDagen, 0);
  const totalPrognoseDagen = data.reduce((sum, m) => sum + m.prognoseDagen, 0);
  const omzetPercent = jaaromzet > 0 ? Math.round((totalRealisatieOmzet / jaaromzet) * 100) : 0;
  const dagenPercent = totalPrognoseDagen > 0 ? Math.round((totalRealisatieDagen / totalPrognoseDagen) * 100) : 0;

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
    ["prognose obv omzet to date", (m) => m.jrPrognoseObvTotNu],
  ];

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">Omzetprognose overzicht</h1>
      <p className="mb-4 text-gray-600">
        Prognose jaaromzet:&nbsp;
        <strong>
          € {jaaromzet.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
        </strong>
        {vorigJaarOmzet > 0 && (
          <span className="text-gray-500"> (Omzet vorig jaar: € {vorigJaarOmzet.toLocaleString("nl-NL", { maximumFractionDigits: 0 })})</span>
        )}
      </p>
      <div className="overflow-auto">
        <table className="table-auto border border-collapse w-full text-sm">
          <tbody>
            {rows.map(([label, fn], rowIdx) => (
              <tr key={label} className={isHeaderLabel(label) ? "bg-gray-200" : "border-t"}>
                <td className={`px-2 py-1 text-left whitespace-nowrap ${isHeaderLabel(label) ? "font-bold" : "font-medium"}`}>{label}</td>
                {data.map((m) => {
                  const raw = fn(m);
                  let display = "";
                  if (isHeaderLabel(label)) display = maandNamen[m.maand - 3];
                  else if (raw === null || raw === 0) display = "";
                  else if (label === "dagen") display = Math.round(raw).toLocaleString("nl-NL");
                  else if (label === "voor/achter in dagen") display = raw.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                  else if (label.includes("%")) display = `${Math.round(raw * 100)}%`;
                  else display = raw.toLocaleString("nl-NL", { maximumFractionDigits: 0 });

                  let cellClass = "px-2 py-1 text-right font-mono border";
                  if (isHeaderLabel(label)) cellClass = "px-2 py-1 text-right font-bold border";
                  if (label === "omzet/dag" && rowIdx === 7 && raw !== null) cellClass += raw > (m.prognosePerDag || 0) ? " bg-green-100" : " bg-red-100";
                  if (label === "prognose plusmin" && raw !== null) cellClass += raw > 0 ? " bg-green-100" : " bg-red-100";

                  return <td key={m.maand + label} className={cellClass}>{display}</td>;
                })}
                <td className="px-2 py-1 text-right font-bold border">
                  {label === "omzet"
                    ? '€ ' + data.reduce((sum, m) => sum + (fn(m) || 0), 0).toLocaleString("nl-NL", { maximumFractionDigits: 0 })
                    : label === "dagen"
                    ? data.reduce((sum, m) => sum + (fn(m) || 0), 0).toLocaleString("nl-NL")
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
                        } else return "";
                        return totDg > 0 ? Math.round(totOm / totDg).toLocaleString("nl-NL") : "";
                      })()
                    : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-sm">
        <p>
          Gedaan <strong>{omzetPercent}%</strong> van de omzet in <strong>{dagenPercent}%</strong> van de dagen
        </p>
      </div>
    </main>
  );
}
