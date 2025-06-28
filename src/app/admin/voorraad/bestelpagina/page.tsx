"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";

interface Leverancier {
  id: number;
  naam: string;
}

interface Product {
  id: number;
  naam: string;
  bestelnummer?: string;
  besteleenheid?: number;
  huidige_prijs?: number;
  volgorde?: number;
}

type Invoer = Record<number, number>;

export default function BestelPagina() {
  const [leverancierId, setLeverancierId] = useState<number | null>(null);
  const [invoer, setInvoer] = useState<Invoer>({});
  const [datumPrefix] = useState(() => {
    const vandaag = new Date();
    return `${vandaag.getFullYear()}${(vandaag.getMonth() + 1)
      .toString()
      .padStart(2, "0")}${vandaag.getDate().toString().padStart(2, "0")}`;
  });
  const [referentieSuffix, setReferentieSuffix] = useState("");
  const referentie = `${datumPrefix}-${referentieSuffix}`;
  const [opmerking, setOpmerking] = useState("");

  // Ophalen onderhanden bestelling
  useEffect(() => {
    if (!leverancierId) return;
    fetch(`/api/bestelling/onderhanden?leverancier=${leverancierId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.data) setInvoer(data.data);
      });
  }, [leverancierId]);

  // Opslaan onderhanden bestelling
  useEffect(() => {
    if (leverancierId == null) return;
    fetch("/api/bestelling/onderhanden", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leverancier_id: leverancierId,
        data: invoer,
        referentie: new Date().toISOString().slice(0, 10),
      }),
    });
  }, [invoer, leverancierId]);

  const { data: leveranciers } = useSWR<Leverancier[]>("/api/leveranciers", fetcher);
  const { data: producten } = useSWR<Product[]>(
    leverancierId ? `/api/producten?leverancier=${leverancierId}` : null,
    fetcher
  );
  const { data: historie } = useSWR<any[]>(
    leverancierId ? `/api/bestelling/historie?leverancier=${leverancierId}` : null,
    fetcher
  );

  function wijzigAantal(productId: number, delta: number) {
    setInvoer((huidige) => {
      const nieuw = { ...huidige };
      nieuw[productId] = Math.max(0, (nieuw[productId] || 0) + delta);
      return nieuw;
    });
  }

  function genereerTekst(): string {
    const leverancierNaam = leveranciers?.find((l) => l.id === leverancierId)?.naam ?? "Onbekend";
    let tekst = `Bestelling IJssalon Vincenzo – ${leverancierNaam}\nReferentie: ${referentie}\n\n`;
    producten?.forEach((p) => {
      const aantal = invoer[p.id] ?? 0;
      if (aantal > 0) {
        tekst += `- [${p.bestelnummer ?? p.id}] ${p.naam} : ${aantal} x\n`;
      }
    });
    if (opmerking.trim()) tekst += `\nOpmerkingen: ${opmerking.trim()}`;
    return tekst;
  }

  if (!leveranciers) return <p>Laden...</p>;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">📦 Bestellen</h1>
      {/* Leverancier select */}
      <select
        className="border rounded px-3 py-2"
        value={leverancierId ?? ""}
        onChange={(e) => setLeverancierId(Number(e.target.value))}
      >
        <option value="">-- Kies leverancier --</option>
        {leveranciers.map((l) => (
          <option key={l.id} value={l.id}>
            {l.naam}
          </option>
        ))}
      </select>

      {/* Desktop UI */}
      {leverancierId && (
        <div className="hidden md:block">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <label className="text-sm font-semibold">Referentie:<\/label>
            <input
              type="text"
              value={referentieSuffix}
              onChange={(e) => setReferentieSuffix(e.target.value)}
              className="border px-2 py-1 rounded w-full md:w-60"
              placeholder="bijv. vrijdag"
            />
          <\/div>
          <div className="text-sm text-gray-700 mt-2 font-semibold">
            Totaal: € {producten
              ?.reduce((sum, p) => sum + (invoer[p.id] ?? 0) * Number(p.huidige_prijs ?? 0), 0)
              .toFixed(2)}
          <\/div>
          {/* Opmerking veld toegevoegd */}
          <textarea
            className="w-full border px-3 py-2 rounded mt-2"
            placeholder="Opmerkingen (optioneel)"
            rows={3}
            value={opmerking}
            onChange={(e) => setOpmerking(e.target.value)}
          />
        </div>
          <div className="text-sm text-gray-700 mt-2 font-semibold">
            Totaal: € {producten
              ?.reduce((sum, p) => sum + (invoer[p.id] ?? 0) * Number(p.huidige_prijs ?? 0), 0)
              .toFixed(2)}
          </div>
        </div>
      )}

      {/* Producttabel + historie */}
      {producten && (
          <div className="hidden md:block">
            <table className="w-full text-sm border mt-4">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-2">Product</th>
                  <th className="text-left p-2">Eenheid</th>
                  <th className="text-left p-2">Prijs</th>
                  <th className="text-left p-2">Aantal</th>
                  <th className="text-left p-2">Actie</th>
                  {(historie ?? []).slice(0, 6).map((b, i) => (
                    <th
                      key={i}
                      className="text-center p-2 font-semibold"
                      title={`Besteld op ${new Date(b.besteld_op).toLocaleDateString('nl-NL')}`}
                    >
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...producten]
                  .sort((a, b) => (a.volgorde ?? 999) - (b.volgorde ?? 999))
                  .map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="p-2">{p.naam}</td>
                      <td className="p-2">{p.besteleenheid ?? 1}</td>
                      <td className="p-2">
                        {p.huidige_prijs != null ? `€ ${Number(p.huidige_prijs).toFixed(2)}` : '–'}
                      </td>
                      <td className="p-2">{invoer[p.id] ?? 0}</td>
                      <td className="p-2 space-x-2">
                        <button
                          onClick={() => wijzigAantal(p.id, -1)}
                          className="px-2 py-1 bg-gray-200 rounded"
                        >
                          –
                        </button>
                        <button
                          onClick={() => wijzigAantal(p.id, 1)}
                          className="px-2 py-1 bg-blue-600 text-white rounded"
                        >
                          +
                        </button>
                      </td>
                      {(historie ?? []).slice(0, 6).map((b, i) => (
                        <td key={i} className="p-2 text-center font-bold">
                          {b.data?.[p.id] ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

      {/* Desktop Mail + Reset */}
      {leverancierId && (
        <div className="hidden md:flex gap-4 mt-6">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={async () => {
              const tekst = genereerTekst();
              const naar = prompt("Naar welk e-mailadres moet de bestelling?", "info@ijssalonvincenzo.nl");
              if (!naar) return;
              const res = await fetch("/api/mail/bestelling", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ naar, onderwerp: `Bestelling ${referentie}`, tekst }),
              });
              if (res.ok) {
                await fetch(`/api/bestelling/historie`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ leverancier_id: leverancierId, data: invoer, referentie, opmerking }),
                });
                await fetch(`/api/bestelling/onderhanden?leverancier=${leverancierId}`, { method: 'DELETE' });
                setInvoer({});
                alert("Bestelling is verzonden!");
              } else {
                alert("Verzenden mislukt.");
              }
            }}
          >
            📧 Mail bestelling
          </button>
          <button
            className="bg-red-500 text-white px-4 py-2 rounded"
            onClick={async () => {
              await fetch(`/api/bestelling/onderhanden?leverancier=${leverancierId}`, {
                method: 'DELETE',
              });
              setInvoer({});
            }}
          >
            Reset bestelling
          </button>
        </div>
      )}
      )

      {/* Mobile iPhone Interface */}
      {leverancierId && (
        <div className="md:hidden space-y-4">
          {/* Mobiele interface: alles op één regel */}
          {producten?.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b py-2">
              <span className="flex-1">{p.naam}</span>
              <div className="flex items-center space-x-2">
                <button onClick={() => wijzigAantal(p.id, -1)} className="px-2 py-1 bg-gray-200 rounded">–</button>
                <span className="w-6 text-center">{invoer[p.id] ?? 0}</span>
                <button onClick={() => wijzigAantal(p.id, 1)} className="px-2 py-1 bg-blue-600 text-white rounded">+</button>
              </div>
            </div>
          ))}
          {/* Mobiele knoppen onderaan */}
          <div className="flex flex-col space-y-2">
            <button
              className="w-full bg-green-500 text-white px-4 py-2 rounded"
              onClick={() => {
                const tekst = encodeURIComponent(genereerTekst());
                window.open(`https://wa.me/?text=${tekst}`);
              }}
            >
              📱 WhatsApp bestellen
            </button>
            <button
              className="w-full bg-red-500 text-white px-4 py-2 rounded"
              onClick={async () => {
                await fetch(`/api/bestelling/onderhanden?leverancier=${leverancierId}`, { method: 'DELETE' });
                setInvoer({});
              }}
            >
              Reset bestelling
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Fout bij ophalen');
  return res.json();
}
