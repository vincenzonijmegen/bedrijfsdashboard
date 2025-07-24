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

  const isHeader = (label: string) =>
    ["PROGNOSE", "REALISATIE", "TO-DO", "PROGNOSES"].includes(label);

  const rows: [string, (m: MaandData) => number | null][] = [
    ["PROGNOSE", () => null],
    ["omzet", (m) => m.prognoseOmzet],
    ["dagen", (m) => m.prognoseDagen],
    ["omzet/dag", (m) => m.prognosePerDag],
    ["REALISATIE", () => null],
    ["omzet", (m) => m.realisatieOmzet],
    ["dagen", (m) => m.realisatieDagen],
    ["omzet/dag", (m) => m.realisatiePerDag],
    ["TO-DO", () => null],
    ["omzet", (m) => m.todoOmzet],
    ["dagen", (m) => m.todoDagen],
    ["omzet/dag", (m) => m.todoPerDag],
    ["PROGNOSES", () => null],
    ["Prognose obv huidig", (m) => m.prognoseHuidig],
    ["Prognose plusmin", (m) => m.plusmin],
    ["Jrprgn. obv omzet to date", (m) => m.jrPrognoseObvTotNu],
    ["Realisatie cumulatief", (m) => m.cumulatiefRealisatie],
  ];

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">Omzetprognose overzicht</h1>

      <p className="mb-4 text-gray-600">
        Jaaromzet: <strong>€ {jaaromzet.toLocaleString("nl-NL", {maximumFractionDigits:0})}</strong>
      </p>

      <div className="overflow-auto">
        <table className="table-auto border border-collapse w-full text-sm">
          <thead className="bg-gray-200 font-bold">
            <tr>
              <th className="px-2 py-1 text-left">MAAND</th>
              {data.map((m) => (
                <th key={m.maand} className="px-2 py-1 text-right">
                  {maandNamen[m.maand - 3]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, fn]) => (
              <tr key={label} className={isHeader(label) ? "bg-gray-200" : "border-t"}>
                <td className={`${isHeader(label) ? "font-bold" : "font-medium"} px-2 py-1 text-left whitespace-nowrap`}>
                  {label}
                </td>
                {data.map((m) => {
                  const raw = fn(m);
                  // Hide zeros and nulls, but show month names for header rows
                  if (raw === null || raw === 0) {
                    return (
                      <td key={m.maand + label} className="px-2 py-1 text-right">
                        {isHeader(label) ? maandNamen[m.maand - 3] : ' '}
                      </td>
                    );
                  }
                  let display;
                  if (label === "dagen") {
                    display = Math.round(raw).toLocaleString("nl-NL");
                  } else if (label.includes("%")) {
                    display = `${Math.round(raw * 100)}%`;
                  } else {
                    // currency values, round to whole
                    display = raw.toLocaleString("nl-NL", {maximumFractionDigits:0});
                  }
                  return <td key={m.maand + label} className="px-2 py-1 text-right">{display}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
