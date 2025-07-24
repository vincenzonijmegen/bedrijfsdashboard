"use client";

import React, { useEffect, useState } from "react";

const maandNamen = [
  "", "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december"
];

export default function PrognoseVerdeling() {
  const [verdeling, setVerdeling] = useState<{ maand: number; percentage: number }[]>([]);
  const [jaaromzet, setJaaromzet] = useState(700000);

  useEffect(() => {
    fetch("/api/prognose/verdeling")
      .then((res) => res.json())
      .then(setVerdeling)
      .catch((err) => console.error("Fout bij ophalen verdeling", err));
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-4 bg-white shadow rounded">
      <h2 className="text-xl font-semibold mb-4">Omzetprognose per maand</h2>

      <label className="block mb-4">
        Jaaromzet (€): 
        <input
          type="number"
          value={jaaromzet}
          onChange={(e) => setJaaromzet(Number(e.target.value))}
          className="ml-2 p-1 border rounded w-40"
        />
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
                {Math.round(jaaromzet * percentage).toLocaleString("nl-NL", {
                  style: "currency",
                  currency: "EUR"
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
