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
      .then(res => res.json())
      .then(res => {
        setData(res.resultaten);
        setJaaromzet(res.jaaromzet);
      });
  }, []);

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
              <th className="px-2 py-1 text-left">PROGNOSE</th>
              {data.map((m) => (
                <th key={"prognose-" + m.maand} className="px-2 py-1 text-right">{maandNamen[m.maand - 3]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {([
              ["omzet", (m: MaandData) => m.prognoseOmzet],
              ["dagen", (m: MaandData) => m.prognoseDagen],
              ["omzet/dag", (m: MaandData) => m.prognosePerDag],
            ] as [string, (m: MaandData) => number | null][]).map(([label, fn]) => (
              <tr key={"prognose-" + label} className="border-t">
                <td className="font-medium px-2 py-1 text-left whitespace-nowrap">{label}</td>
                {data.map((m) => {
                  const value = fn(m);
                  return (
                    <td key={m.maand + label} className="px-2 py-1 text-right font-mono">
                      {value === null
                        ? "-"
                        : typeof value === "number"
                        ? label.includes("dag") && !label.includes("€")
                          ? value.toLocaleString("nl-NL")
                          : label.includes("%")
                          ? `${Math.round(100 * value)}%`
                          : value.toLocaleString("nl-NL", {
                              style: "currency",
                              currency: "EUR",
                              maximumFractionDigits: 0,
                            })
                        : value}
                    </td>
                  );
                })}
              </tr>
            ))}

            {([
              ["TO-DO omzet", (m: MaandData) => m.todoOmzet],
              ["TO-DO dagen", (m: MaandData) => m.todoDagen],
              ["TO-DO €/dag", (m: MaandData) => m.todoPerDag],
              ["Prognose obv huidig", (m: MaandData) => m.prognoseHuidig],
              ["Prognose plusmin", (m: MaandData) => m.plusmin],
              ["Voor/achter in dagen", (m: MaandData) => m.voorAchterInDagen],
              ["Plusomzet-to-date", (m: MaandData) => m.plusmin],
              ["Omzet plus min cumul.", (m: MaandData) => m.cumulatiefPlus],
              ["Jrprgn. obv omzet to date", (m: MaandData) => m.jrPrognoseObvTotNu],
              ["Prognose cumulatief", (m: MaandData) => m.cumulatiefPrognose],
              ["Realisatie cumulatief", (m: MaandData) => m.cumulatiefRealisatie],
              ["% plus min", (m: MaandData) => m.procentueel],
            ] as [string, (m: MaandData) => number | null][]).map(([label, fn]) => (
              <tr key={label} className="border-t">
                <td className="font-medium px-2 py-1 text-left whitespace-nowrap">{label}</td>
                {data.map((m) => {
                  const value = fn(m);
                  return (
                    <td key={m.maand + label} className="px-2 py-1 text-right font-mono">
                      {value === null
                        ? "-"
                        : typeof value === "number"
                        ? label.includes("dag") && !label.includes("€")
                          ? value.toLocaleString("nl-NL")
                          : label.includes("%")
                          ? `${Math.round(100 * value)}%`
                          : value.toLocaleString("nl-NL", {
                              style: "currency",
                              currency: "EUR",
                              maximumFractionDigits: 0,
                            })
                        : value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

          <thead className="bg-gray-200">
            <tr>
              <th className="px-2 py-1 text-left">REALISATIE</th>
              {data.map((m) => (
                <th key={"realisatie-" + m.maand} className="px-2 py-1 text-right">{maandNamen[m.maand - 3]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {([
              ["omzet", (m: MaandData) => m.realisatieOmzet],
              ["dagen", (m: MaandData) => m.realisatieDagen],
              ["omzet/dag", (m: MaandData) => m.realisatiePerDag],
            ] as [string, (m: MaandData) => number | null][]).map(([label, fn]) => (
              <tr key={"realisatie-" + label} className="border-t">
                <td className="font-medium px-2 py-1 text-left whitespace-nowrap">{label}</td>
                {data.map((m) => {
                  const value = fn(m);
                  return (
                    <td key={m.maand + "realisatie-" + label} className="px-2 py-1 text-right font-mono">
                      {value === null
                        ? "-"
                        : typeof value === "number"
                        ? label.includes("dag") && !label.includes("€")
                          ? value.toLocaleString("nl-NL")
                          : label.includes("%")
                          ? `${Math.round(100 * value)}%`
                          : value.toLocaleString("nl-NL", {
                              style: "currency",
                              currency: "EUR",
                              maximumFractionDigits: 0,
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
