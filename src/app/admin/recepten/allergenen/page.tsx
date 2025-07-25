// src/app/admin/recepten/allergenenkaart/page.tsx

"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";

const ALLERGENEN = ["gluten", "soja", "ei", "melk", "noten", "pinda", "tarwe"];

interface Recept {
  id: number;
  naam: string;
  omschrijving?: string;
  regels: { product_id: number }[];
}

interface ProductAllergenen {
  product_id: number;
  allergeen: string;
}

export default function AllergenenKaart() {
  const { data: recepten } = useSWR<Recept[]>("/api/recepten", fetcher);
  const { data: allergenenData } = useSWR<ProductAllergenen[]>("/api/allergenen/receptniveau", fetcher);

  const gegroepeerd: Record<number, string[]> = {};
  allergenenData?.forEach((r) => {
    if (!gegroepeerd[r.product_id]) gegroepeerd[r.product_id] = [];
    gegroepeerd[r.product_id].push(r.allergeen);
  });

  function allergenenVoorRecept(r: Recept): string[] {
    const verzameld = new Set<string>();
    r.regels.forEach((regel) => {
      gegroepeerd[regel.product_id]?.forEach((a) => verzameld.add(a));
    });
    return Array.from(verzameld).sort();
  }

  const gegroepeerdPerSoort: Record<string, Recept[]> = {};
  recepten
    ?.filter(r => !["mixen", "vruchtensmaken"].includes(r.omschrijving ?? ""))
    .forEach((r) => {
      const cat = r.omschrijving || "overig";
      if (!gegroepeerdPerSoort[cat]) gegroepeerdPerSoort[cat] = [];
      gegroepeerdPerSoort[cat].push(r);
    });

  const volgorde = ["melksmaken", "overig"];

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-center">🧾 Allergenenkaart IJssalon Vincenzo</h1>
      <p className="text-center text-yellow-600 font-semibold uppercase">
        Alle sorbetsmaken zijn veganistisch en allergenenvrij
      </p>
      <div className="overflow-x-auto space-y-6">
        {volgorde.map((soort) => (
          <div key={soort}>
            <h2 className="text-lg font-bold mb-2 uppercase">{soort === "overig" ? "OVERIG" : "ROOMIJS"}</h2>
            <table className="w-full border text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1 text-left">Smaak</th>
                  {ALLERGENEN.map((a) => (
                    <th key={a} className="border px-2 py-1 text-center uppercase w-20">{a}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gegroepeerdPerSoort[soort]?.sort((a, b) => a.naam.localeCompare(b.naam)).map((r) => {
                  const aanwezig = new Set(allergenenVoorRecept(r));
                  return (
                    <tr key={r.id}>
                      <td className="border px-2 py-1 font-semibold whitespace-nowrap">{r.naam}</td>
                      {ALLERGENEN.map((a) => (
                        <td
                          key={a}
                          className={`border px-2 py-1 text-center w-20 ${aanwezig.has(a) ? "bg-red-500 text-white" : ""}`}
                        >
                          {aanwezig.has(a) ? "●" : ""}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </main>
  );
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fout bij ophalen");
  return res.json();
}
