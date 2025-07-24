"use client";

import React, { useEffect, useState } from "react";

export default function PrognoseVerdeling() {
  const [verdeling, setVerdeling] = useState<{ maand: number; percentage: number }[]>([]);
  const [jaaromzet, setJaaromzet] = useState<number | null>(null);
  const [jaren, setJaren] = useState<number>(0);
  const [automatischBerekend, setAutomatischBerekend] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/prognose/verdeling")
      .then((res) => res.json())
      .then((data) => {
        setVerdeling(data.verdeling);
        setJaren(data.jaren);
        setJaaromzet(data.omzetPrognose);
        setAutomatischBerekend(true);
      })
      .catch((err) => console.error("Fout bij ophalen verdeling", err));
  }, []);

  const maandNamen = [
    "", "januari", "februari", "maart", "april", "mei", "juni",
    "juli", "augustus", "september", "oktober", "november", "december"
  ];

  return (
    <div className="max-w-2xl mx-auto p-4 bg-white shadow rounded">
      <h2 className="text-xl font-semibold mb-4">Omzetprognose per maand</h2>

      <p className="text-sm text-gray-500 mb-2">
        Gebaseerd op {jaren} jaar{jaren !== 1 ? "en" : ""} (exclusief huidig jaar)
      </p>

      <label className="block mb-4">
        Jaaromzet (€):
        <input
          type="number"
          value={jaaromzet ?? ""}
          onChange={(e) => {
            setJaaromzet(Number(e.target.value));
            setAutomatischBerekend(false);
          }}
          className="ml-2 p-1 border rounded w-40"
        />
        {automatischBerekend && (
          <span className="ml-2 text-sm text-green-600">
            (automatisch berekend op basis van vorig jaar + 3%)
          </span>
        )}
      </label>

      <table className="w-full table-auto border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-2 py-1">Maand</th>
            <th className="text-right px-2 py-1">Percentage</th>
            <th className="text-right px-2 py-1">Prognose (€)</th>
          </tr>
        </thead>
        <tbody>
          {verdeling.map(({ maand, percentage }) => (
            <tr key={maand} className="border-t">
              <td className="px-2 py-1">{maandNamen[maand]}</td>
              <td className="px-2 py-1 text-right">{(percentage * 100).toFixed(2)}%</td>
              <td className="px-2 py-1 text-right font-mono">
                {jaaromzet !== null
                  ? (jaaromzet * percentage).toLocaleString("nl-NL", {
                      style: "currency",
                      currency: "EUR",
                    })
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
