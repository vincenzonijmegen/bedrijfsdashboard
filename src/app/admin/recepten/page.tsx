// src/app/admin/recepten/page.tsx

"use client";

import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";

interface Product {
  id: number;
  naam: string;
  eenheid: string;
  inhoud?: number;
  huidige_prijs?: number;
}

interface ReceptRegel {
  product_id: number;
  hoeveelheid: number;
  eenheid: string;
  product_naam?: string;
}

interface Recept {
  id?: number;
  naam: string;
  omschrijving?: string;
  totaal_output?: number;
  eenheid?: string;
  product_id?: number;
  regels: ReceptRegel[];
}

export default function ReceptenBeheer() {
  const [recept, setRecept] = useState<Recept>({ naam: "", regels: [] });
  const { data: producten } = useSWR<Product[]>("/api/producten", fetcher);
  const { data: recepten } = useSWR<Recept[]>("/api/recepten", fetcher);
  const [openReceptId, setOpenReceptId] = useState<number | null>(null);

  function wijzigRegel(index: number, veld: keyof ReceptRegel, waarde: any) {
    const nieuw = [...recept.regels];
    nieuw[index] = { ...nieuw[index], [veld]: waarde };
    setRecept({ ...recept, regels: nieuw });
  }

  function berekenRegelKostprijs(regel: ReceptRegel): number {
    const prod = producten?.find((p) => p.id === regel.product_id);
    if (!prod || !prod.inhoud || !prod.huidige_prijs) return 0;
    const prijsPerEenheid = prod.huidige_prijs / prod.inhoud;
    return prijsPerEenheid * regel.hoeveelheid;
  }

  function berekenTotaalprijs(r: Recept): number {
    return r.regels.reduce((t, regel) => {
      const prod = producten?.find((p) => p.id === regel.product_id);
      if (!prod || !prod.inhoud || !prod.huidige_prijs) return t;
      const prijsPerEenheid = prod.huidige_prijs / prod.inhoud;
      return t + prijsPerEenheid * regel.hoeveelheid;
    }, 0);
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">📋 Receptbeheer</h1>

      <form
        className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 border rounded"
        onSubmit={async (e) => {
          e.preventDefault();
          await fetch("/api/recepten", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...recept,
              regels: recept.regels.filter((r) => r.product_id && r.hoeveelheid > 0)
            }),
          });
          mutate("/api/recepten");
          setRecept({ naam: "", regels: [] });
        }}
      >
        <input
          type="text"
          placeholder="Naam recept"
          className="border px-2 py-1 rounded col-span-2"
          value={recept.naam}
          onChange={(e) => setRecept({ ...recept, naam: e.target.value })}
        />

        <input
          type="text"
          placeholder="Omschrijving"
          className="border px-2 py-1 rounded col-span-2"
          value={recept.omschrijving ?? ""}
          onChange={(e) => setRecept({ ...recept, omschrijving: e.target.value })}
        />

        <input
          type="number"
          placeholder="Totaaloutput (bijv. 180)"
          className="border px-2 py-1 rounded"
          value={recept.totaal_output ?? ""}
          onChange={(e) => setRecept({ ...recept, totaal_output: parseFloat(e.target.value) })}
        />

        <select
          value={recept.eenheid ?? ""}
          onChange={(e) => setRecept({ ...recept, eenheid: e.target.value })}
          className="border px-2 py-1 rounded"
        >
          <option value="">-- eenheid --</option>
          <option value="g">gram</option>
          <option value="kg">kilogram</option>
          <option value="ml">milliliter</option>
          <option value="l">liter</option>
        </select>

        <h2 className="col-span-2 font-semibold mt-4">Ingrediënten</h2>

        {recept.regels.map((regel, i) => {
          const prod = producten?.find(p => p.id === regel.product_id);
          const geenInhoud = prod && prod.inhoud == null;
          return (
            <div key={i} className="col-span-2 flex gap-2 items-center">
              <select
                value={regel.product_id}
                onChange={(e) => wijzigRegel(i, "product_id", Number(e.target.value))}
                className="border px-2 py-1 rounded w-1/3"
              >
                <option value="">-- kies product --</option>
                {producten?.map((p) => (
                  <option key={p.id} value={p.id}>{p.naam}</option>
                ))}
              </select>

              <input
                type="number"
                placeholder="Hoeveelheid"
                value={regel.hoeveelheid}
                onChange={(e) => wijzigRegel(i, "hoeveelheid", parseFloat(e.target.value))}
                className="border px-2 py-1 rounded w-1/4"
              />

              <select
                value={regel.eenheid}
                onChange={(e) => wijzigRegel(i, "eenheid", e.target.value)}
                className="border px-2 py-1 rounded w-1/4"
              >
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="ml">ml</option>
                <option value="l">l</option>
              </select>

              <button
                type="button"
                onClick={() => setRecept({
                  ...recept,
                  regels: recept.regels.filter((_, idx) => idx !== i),
                })}
                className="text-red-600"
              >🗑️</button>

              {geenInhoud && <span className="text-xs text-red-600">⚠️ Geen inhoud geregistreerd</span>}
            </div>
          );
        })}

        <div className="col-span-2">
          <button
            type="button"
            className="text-sm text-blue-600"
            onClick={() => setRecept({
              ...recept,
              regels: [...recept.regels, { product_id: 0, hoeveelheid: 0, eenheid: "g" }],
            })}
          >+ Regel toevoegen</button>
        </div>

        <div className="col-span-2">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
            Recept opslaan
          </button>
        </div>
      </form>

      <h2 className="text-xl font-semibold">📚 Bestaande recepten</h2>
      <ul className="pl-0">
        {recepten?.map((r) => {
          const totaal = berekenTotaalprijs(r);
          const isOpen = openReceptId === (r.id ?? null);
          return (
            <li key={r.id} className="mb-2 border rounded">
              <button
                onClick={() => setOpenReceptId(isOpen ? null : r.id ?? null)}
                className="flex justify-between items-center w-full px-4 py-2 text-left bg-gray-100 hover:bg-gray-200"
              >
                <span>{r.naam}</span>
                <span className="font-mono text-sm">€ {totaal.toFixed(2)}</span>
              </button>
              {isOpen && (
                <div className="p-4 text-sm bg-white border-t">
                  <ul className="space-y-1">
                    {r.regels.map((regel, i) => {
                      const prod = producten?.find((p) => p.id === regel.product_id);
                      const prijs = berekenRegelKostprijs(regel);
                      return (
                        <li key={i} className="flex justify-between">
                          <span>{prod?.naam ?? "?"} ({regel.hoeveelheid} {regel.eenheid})</span>
                          <span className="text-right">€ {prijs.toFixed(2)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fout bij ophalen");
  return res.json();
}
