// src/app/admin/omzet/prognose/page.tsx
"use client";

import React, { useEffect, useState } from "react";

const maandNamen = [
  "maart", "april", "mei", "juni", "juli", "augustus", "september"
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
  prognoseHuidig: number; // realisatiePerDag * prognoseDagen
  plusmin: number; // prognoseHuidig - prognoseOmzet
  cumulatiefPlus: number;
  cumulatiefPrognose: number;
  cumulatiefRealisatie: number;
  voorAchterInDagen: number | null;
  procentueel: number | null;
  jrPrognoseObvTotNu: number; // cumulatiefRealisatie + totaalPrognoseRest (realisatiePerDag × todoDagen)
}

export default function PrognosePage() {
  const [data, setData] = useState<MaandData[]>([]);
  const [jaaromzet, setJaaromzet] = useState<number>(0);

  useEffect(() => {
    fetch("/api/prognose/analyse")
      .then(res => res.json())
      .then(res => {
        setData(res.resultaten);
        setJaaromzet(res.jaaromzet);
      });
  }, []);

  // helper om de koprĳen te markeren
  const isHeader = (label: string) =>
    label === "REALISATIE" || label === "TO-DO" || label === "PROGNOSES" || label === "PROGNOSE";

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">Omzetprognose overzicht</h1>

      <p className="mb-4 text-gray-600">
        Jaaromzet: <strong>€ {jaaromzet.toLocaleString("nl-NL")}</strong>
      </p>

      <div className="overflow-auto">
        <table className="table-auto border border-collapse w-full text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="font-bold px-2 py-1 text-left">PROGNOSE</th>
              {data.map((m) => (
                <th key={"prognose-" + m.maand} className="font-bold px-2 py-1 text-right">
                  {maandNamen[m.maand - 3]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {([
              ["omzet", (m: MaandData) => m.prognoseOmzet],
              ["dagen", (m: MaandData) => m.prognoseDagen],
              ["omzet/dag", (m: MaandData) => m.prognosePerDag],
              ["REALISATIE", () => null],
              ["omzet", (m: MaandData) => m.realisatieOmzet],
              ["dagen", (m: MaandData) => m.realisatieDagen],
              ["omzet/dag", (m: MaandData) => m.realisatiePerDag],
              ["TO-DO", () => null],
              ["omzet", (m: MaandData) => m.todoOmzet],
              ["dagen", (m: MaandData) => m.todoDagen],
              ["omzet/dag", (m: MaandData) => m.todoPerDag],
              ["PROGNOSES", () => null],
              ["Prognose obv huidig", (m: MaandData) => m.prognoseHuidig],
              ["Prognose plusmin", (m: MaandData) => m.plusmin],
              ["Jrprgn. obv omzet to date", (m: MaandData) => m.jrPrognoseObvTotNu],
              ["Realisatie cumulatief", (m: MaandData) => m.cumulatiefRealisatie],
            ] as [string, (m: MaandData) => number | null][]).map(([label, fn]) => (
              <tr
                key={label}
                className={isHeader(label) ? "bg-gray-200" : "border-t"}
              >
                <td
                  className={`${
                    isHeader(label) ? "font-bold" : "font-medium"
                  } px-2 py-1 text-left whitespace-nowrap`}
                >
                  {label}
                </td>
                {data.map((m) => {
                  const value = fn(m);
                  return (
                    <td
                      key={m.maand + label}
                      className="px-2 py-1 text-right font-mono"
                    >
                      {value === null
                        ? isHeader(label)
                          ? maandNamen[m.maand - 3]
                          : "-"
                        : typeof value === "number"
                        ? label === "dagen"
                          ? Math.round(value).toLocaleString("nl-NL")
                          : label === "Voor/achter in dagen"
                          ? value.toLocaleString("nl-NL", {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })
                          : label.includes("%")
                          ? `${Math.round(100 * value)}%`
                          : value.toLocaleString("nl-NL", {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })
                        : value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
