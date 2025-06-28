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
    return `${vandaag.getFullYear()}${(vandaag.getMonth() + 1).toString().padStart(2, "0")}${vandaag.getDate().toString().padStart(2, "0")}`;
  });
  const [referentieSuffix, setReferentieSuffix] = useState("");
  const referentie = `${datumPrefix}-${referentieSuffix}`;
  const [opmerking, setOpmerking] = useState("");

  useEffect(() => {
    if (!leverancierId) return;
    fetch(`/api/bestelling/onderhanden?leverancier=${leverancierId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.data) setInvoer(data.data);
      });
  }, [leverancierId]);

  useEffect(() => {
    if (leverancierId != null) {
      fetch("/api/bestelling/onderhanden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leverancier_id: leverancierId,
          data: invoer,
          referentie: new Date().toISOString().slice(0, 10),
        }),
      });
    }
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

  function genereerTekst(
    producten: Product[],
    invoer: Invoer,
    referentie: string,
    leveranciers: Leverancier[] | undefined,
    leverancierId: number | null,
    opmerking: string
  ) {
    const leverancierNaam = leveranciers?.find((l) => l.id === leverancierId)?.naam ?? "Onbekend";
    let tekst = `Bestelling IJssalon Vincenzo – ${leverancierNaam}
Referentie: ${referentie}

`;

    producten.forEach((p) => {
      const aantal = invoer[p.id] ?? 0;
      if (aantal > 0) {
        tekst += `- [${p.bestelnummer ?? p.id}] ${p.naam} : ${aantal} x
`;
      }
    });

    if (opmerking.trim()) {
      tekst += `
Opmerkingen: ${opmerking.trim()}`;
    }

    return tekst;
  }

  if (!leveranciers) return <p>Laden...</p>;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">📦 Bestellen</h1>

      <select
        className="border rounded px-3 py-2"
        value={leverancierId ?? ""}
        onChange={(e) => setLeverancierId(Number(e.target.value))}
      >
        <option value="">-- Kies leverancier --</option>
        {leveranciers.map((l) => (
          <option key={l.id} value={l.id}>{l.naam}</option>
        ))}
      </select>

      {leverancierId && (
        <>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <label className="text-sm font-semibold">Referentie:</label>
            <input
              type="text"
              value={referentieSuffix}
              onChange={(e) => setReferentieSuffix(e.target.value)}
              className="border px-2 py-1 rounded w-full md:w-60"
              placeholder="bijv. vrijdag"
            />
          </div>

          <div className="text-sm text-gray-700 mt-2 font-semibold">
            Totaal: €{" "}
            {producten?.reduce((totaal, p) => {
              const aantal = invoer[p.id] ?? 0;
              const prijs = Number(p.huidige_prijs ?? 0);
              return totaal + aantal * prijs;
            }, 0).toFixed(2)}
          </div>
        </>
      )}

      {producten && (
        <table className="w-full text-sm border mt-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left p-2">Product</th>
              <th className="text-left p-2">Eenheid</th>
              <th className="text-left p-2">Prijs</th>
              <th className="text-left p-2">Aantal</th>
              <th className="text-left p-2">Actie</th>
              ${historie?.map((b, i) => `<th key=${i} className=\"text-left p-2\">${b.referentie ?? 'B' + (i + 1)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            {[...producten].sort((a, b) => (a.volgorde ?? 999) - (b.volgorde ?? 999)).map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">{p.naam}</td>
                <td className="p-2">{p.besteleenheid ?? 1}</td>
                <td className="p-2">{p.huidige_prijs != null ? `€ ${Number(p.huidige_prijs).toFixed(2)}` : "–"}</td>
                <td className="p-2">{invoer[p.id] ?? 0}</td>
                <td className="p-2 space-x-2">
                  <button onClick={() => wijzigAantal(p.id, -1)} className="px-2 py-1 bg-gray-200 rounded">–</button>
                  <button onClick={() => wijzigAantal(p.id, 1)} className="px-2 py-1 bg-blue-600 text-white rounded">+</button>
                </td>
                ${historie?.map((b, i) => `<td key=${i} className=\"p-2 text-xs text-gray-500\">${b.data?.[p.id] ?? '-'}</td>`).join('')}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {leverancierId && producten && (
        <div className="space-y-4 mt-6">
          <textarea
            className="w-full border px-3 py-2 rounded"
            placeholder="Opmerkingen (optioneel)"
            rows={3}
            value={opmerking}
            onChange={(e) => setOpmerking(e.target.value)}
          />

          {typeof window !== "undefined" && window.innerWidth > 600 && (
            <div className="flex gap-4">
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded"
                onClick={async () => {
                  const tekst = genereerTekst(producten, invoer, referentie, leveranciers, leverancierId, opmerking);
                  let naar = prompt("Naar welk e-mailadres moet de bestelling?", "info@ijssalonvincenzo.nl");
                  if (!naar) return;

                  const res = await fetch("/api/mail/bestelling", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      naar,
                      onderwerp: `Bestelling ${referentie}`,
                      tekst,
                    }),
                  });

                  if (res.ok) {
  try {
    const resHistorie = await fetch("/api/bestelling/historie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leverancier_id: leverancierId,
        data: invoer,
        referentie,
        opmerking,
      }),
    });

    if (!resHistorie.ok) {
      const fout = await resHistorie.json();
      console.error("❌ Historie-fout:", fout);
    } else {
      await fetch(`/api/bestelling/onderhanden?leverancier=${leverancierId}`, {
        method: "DELETE",
      });
      setInvoer({});
    }
  } catch (err) {
    console.error("❌ Fout bij opslaan/verwijderen na mail:", err);
  }

  alert("Bestelling is verzonden!");
                  } else {
                    alert("Verzenden mislukt.");
                  }
                }}
              >
                📧 Mail bestelling
              </button>
            </div>
          )}
        </div>
      )}

      {leverancierId && (
        <button
          className="mt-4 bg-red-500 text-white px-4 py-2 rounded"
          onClick={async () => {
            await fetch(`/api/bestelling/onderhanden?leverancier=${leverancierId}`, {
              method: "DELETE",
            });
            setInvoer({});
          }}
        >
          Reset bestelling
        </button>
      )}
    </main>
  );
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fout bij ophalen");
  return res.json();
}
