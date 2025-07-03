"use client";

import useSWR, { mutate } from "swr";
import type { Leverancier, Product } from "@/types/db";
import { useEffect, useState } from "react";





export default function Productbeheer() {
  const [leverancierId, setLeverancierId] = useState<number | null>(null);
  const [nieuweLeverancier, setNieuweLeverancier] = useState("");
  const [naam, setNaam] = useState("");
  const [bestelnummer, setBestelnummer] = useState("");
  const [minimumVoorraad, setMinimumVoorraad] = useState<number | undefined>();
  const [besteleenheid, setBesteleenheid] = useState<number>(1);
  const [prijs, setPrijs] = useState<number | undefined>();
  const [actief, setActief] = useState(true);
  const [volgorde, setVolgorde] = useState<number | undefined>();
  const [productId, setProductId] = useState<number | null>(null);

  const { data: leveranciers } = useSWR<Leverancier[]>("/api/leveranciers", fetcher);
  const { data: producten } = useSWR<Product[]>(
    leverancierId ? `/api/producten?leverancier=${leverancierId}` : null,
    fetcher
  );

  useEffect(() => {
    if (leverancierId) {
      mutate(`/api/producten?leverancier=${leverancierId}`);
    }
  }, [leverancierId]);

  if (!leveranciers) return <p>Laden...</p>;

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">🛒 Productbeheer</h1>

      <details className="border p-4 rounded bg-gray-50" open={!!productId}>
        <summary className="cursor-pointer font-semibold mb-2">➕ Nieuw product toevoegen</summary>
        <form
          className="grid grid-cols-2 gap-4 mt-4 text-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            const response = await fetch("/api/producten", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: productId,
                leverancier_id: leverancierId,
                nieuwe_leverancier: nieuweLeverancier || undefined,
                naam,
                bestelnummer,
                minimum_voorraad: minimumVoorraad,
                besteleenheid,
                prijs,
                actief,
                volgorde,
              }),
            });

            if (response.ok) {
              alert("Product opgeslagen!");
              setNaam("");
              setBestelnummer("");
              setMinimumVoorraad(undefined);
              setBesteleenheid(1);
              setPrijs(undefined);
              setActief(true);
              setNieuweLeverancier("");
              setVolgorde(undefined);
              setProductId(null);
              if (leverancierId) {
                mutate(`/api/producten?leverancier=${leverancierId}`);
              }
              mutate("/api/leveranciers");
            } else {
              const fout = await response.json();
              alert("Fout: " + fout.error);
            }
          }}
        >
          <div className="col-span-2">
            <label className="block">Kies bestaande leverancier:</label>
            <select
              className="w-full border rounded px-2 py-1"
              value={leverancierId ?? ""}
              onChange={(e) => setLeverancierId(Number(e.target.value))}
            >
              <option value="">-- Kies --</option>
              {leveranciers.map((l) => (
                <option key={l.id} value={l.id}>{l.naam}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block">of nieuwe leverancier:</label>
            <input
              type="text"
              placeholder="Nieuwe leverancier"
              className="w-full border rounded px-2 py-1"
              value={nieuweLeverancier}
              onChange={(e) => setNieuweLeverancier(e.target.value)}
            />
          </div>

          <input type="text" placeholder="Productnaam" className="border px-2 py-1 rounded" value={naam} onChange={(e) => setNaam(e.target.value)} />
          <input type="text" placeholder="Bestelnummer" className="border px-2 py-1 rounded" value={bestelnummer} onChange={(e) => setBestelnummer(e.target.value)} />
          <input type="number" placeholder="Min. voorraad" className="border px-2 py-1 rounded" value={minimumVoorraad ?? ""} onChange={(e) => setMinimumVoorraad(e.target.value ? Number(e.target.value) : undefined)} />
          <input type="number" placeholder="Besteleenheid" className="border px-2 py-1 rounded" value={besteleenheid} onChange={(e) => setBesteleenheid(Number(e.target.value))} />
          <input type="number" placeholder="Prijs (€)" className="border px-2 py-1 rounded" step="0.01" value={prijs ?? ""} onChange={(e) => setPrijs(e.target.value ? Number(e.target.value) : undefined)} />
          <input type="number" placeholder="Volgorde" className="border px-2 py-1 rounded" value={volgorde ?? ""} onChange={(e) => setVolgorde(e.target.value ? Number(e.target.value) : undefined)} />

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={actief} onChange={(e) => setActief(e.target.checked)} /> Actief
          </label>

          <div className="col-span-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Opslaan</button>
          </div>
        </form>
      </details>

      <select
        className="border rounded px-2 py-1"
        value={leverancierId ?? ""}
        onChange={(e) => setLeverancierId(Number(e.target.value))}
      >
        <option value="">-- Kies leverancier --</option>
        {leveranciers.map((l) => (
          <option key={l.id} value={l.id}>{l.naam}</option>
        ))}
      </select>

      {producten && (
        <table className="w-full text-sm border mt-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left p-2">Naam</th>
              <th className="text-left p-2">Bestelnummer</th>
              <th className="text-left p-2">Min</th>
              <th className="text-left p-2">Eenh.</th>
              <th className="text-left p-2">Prijs</th>
              <th className="text-left p-2">Volgorde</th>
              <th className="text-left p-2">Actief</th>
              <th className="text-left p-2">Actie</th>
              <th className="text-left p-2">Verwijderen</th>
            </tr>
          </thead>
          <tbody>
            {producten.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">{p.naam}</td>
                <td className="p-2">{p.bestelnummer}</td>
                <td className="p-2">{p.minimum_voorraad}</td>
                <td className="p-2">{p.besteleenheid}</td>
                <td className="p-2">{p.huidige_prijs != null ? `€ ${Number(p.huidige_prijs).toFixed(2)}` : "–"}</td>
                <td className="p-2">{p.volgorde ?? "–"}</td>
                <td className="p-2">{p.actief ? "✅" : "❌"}</td>
                <td className="p-2">
                  <button
                    onClick={() => {
                      window.scrollTo({ top: 0, behavior: "smooth" });
                      setProductId(p.id);
                      setNaam(p.naam);
                      setBestelnummer(p.bestelnummer ?? "");
                      setMinimumVoorraad(p.minimum_voorraad);
                      setBesteleenheid(p.besteleenheid ?? 1);
                      setPrijs(p.huidige_prijs);
                      setVolgorde(p.volgorde);
                      setActief(p.actief ?? true); // of false als je dat liever als default hebt
                      setNieuweLeverancier("");
                    }}
                    className="text-blue-600 hover:underline mr-2"
                  >✏️</button>
                </td>
                <td className="p-2">
                  <button
                    onClick={async () => {
                      if (!confirm(`Weet je zeker dat je ${p.naam} wilt verwijderen?`)) return;
                      await fetch(`/api/producten?id=${p.id}`, {
                        method: "DELETE",
                      });
                      if (leverancierId) {
                        mutate(`/api/producten?leverancier=${leverancierId}`);
                      }
                    }}
                    className="text-red-600 hover:underline"
                  >🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fout bij ophalen");
  return res.json();
}
