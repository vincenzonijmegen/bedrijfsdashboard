"use client";

import React, { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useSnackbar } from "@/lib/useSnackbar";

interface Leverancier { id: number; naam: string; soort: string; }
interface Product { id: number; naam: string; bestelnummer?: string; besteleenheid?: number; huidige_prijs?: number; volgorde?: number; }
type Invoer = Record<number, number>;

const fetcher = (url: string) => fetch(url).then(r => { if(!r.ok) throw new Error("Fout bij ophalen"); return r.json(); });
const deepEqual = (a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b);

export default function BestelPagina() {
  const [leverancierId, setLeverancierId] = useState<number|null>(null);
  const [invoer, setInvoer] = useState<Invoer>({});
  const [referentieSuffix, setReferentieSuffix] = useState("");
  const [opmerking, setOpmerking] = useState("");
  const [toonIncidenteel, setToonIncidenteel] = useState(false);

  // gate: autosave pas na eerste load van deze leverancier
  const [loadedLeverancierId, setLoadedLeverancierId] = useState<number|null>(null);
  const suppressUntilRef = useRef<number>(0);
  const lastLocalChangeAtRef = useRef<number>(0);
  const shownOnceRef = useRef<Record<number, boolean>>({});
  const { showSnackbar } = useSnackbar();

  const datumPrefix = new Date().toISOString().slice(0,10).replace(/-/g,"");
  const referentie = `${datumPrefix}-${referentieSuffix}`;

  const { data: leveranciers } = useSWR<Leverancier[]>("/api/leveranciers", fetcher);
  const { data: producten } = useSWR<Product[]>(
    leverancierId ? `/api/producten?leverancier=${leverancierId}` : null, fetcher
  );
  const { data: historie } = useSWR<any[]>(
    leverancierId ? `/api/bestelling/historie?leverancier=${leverancierId}` : null, fetcher
  );
  const { data: onderhanden } = useSWR(
    leverancierId ? `/api/bestelling/onderhanden?leverancier=${leverancierId}` : null,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 5000, focusThrottleInterval: 10000 }
  );

  const onSelectLeverancier: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const id = Number(e.target.value);
    if (Number.isNaN(id)) return;
    setLeverancierId(id);
    setInvoer({});                // leeg lokale invoer
    setLoadedLeverancierId(null); // pauzeer autosave tot server geladen
    shownOnceRef.current[id] = false;
  };

  // Server->client sync (één bron): zet invoer bij echte diff, activeer autosave daarna
  useEffect(() => {
    if (!leverancierId) return;
    if (onderhanden === undefined) return;
    const serverData: Invoer = (onderhanden?.data as Invoer) ?? {};
    if (!deepEqual(invoer, serverData)) setInvoer(serverData);

    const justEditedLocally = Date.now() - lastLocalChangeAtRef.current < 1200;
    if (!shownOnceRef.current[leverancierId] && !justEditedLocally) {
      showSnackbar("Opgeslagen bestelling geladen");
      shownOnceRef.current[leverancierId] = true;
    }
    setLoadedLeverancierId(leverancierId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onderhanden, leverancierId]);

  // ✅ AUTOSAVE: alleen als er items > 0 zijn, niet tijdens suppress, en pas na load-gate
  useEffect(() => {
    if (leverancierId == null) return;
    if (loadedLeverancierId !== leverancierId) return;
    if (Date.now() < suppressUntilRef.current) return;

    const hasItems = Object.values(invoer).some((n) => Number(n) > 0);
    if (!hasItems) return;

    fetch("/api/bestelling/onderhanden", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leverancier_id: leverancierId, data: invoer, referentie }),
    }).catch(() => {});
  }, [invoer, leverancierId, referentie, loadedLeverancierId]);

  const wijzigAantal = (id:number, delta:number) => {
    lastLocalChangeAtRef.current = Date.now();
    setInvoer(prev => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
  };
  const setAantal = (id:number, value:number) => {
    lastLocalChangeAtRef.current = Date.now();
    setInvoer(prev => ({ ...prev, [id]: Math.max(0, value) }));
  };

  const genereerTekst = () => {
    const naam = leveranciers?.find(l => l.id===leverancierId)?.naam ?? "Onbekend";
    const rows: { bestelnummer:string; naam:string; aantal:number }[] = [];
    producten?.forEach(p => { const n = invoer[p.id] ?? 0; if (n>0) rows.push({ bestelnummer: p.bestelnummer ?? String(p.id), naam: p.naam, aantal: n });});
    let tekst = `Bestelling IJssalon Vincenzo – ${naam}
Referentie: ${referentie}

`;
    tekst += `Aantal\tBestelnummer\tProduct
`;
    tekst += `------\t------------\t-------
`;
    rows.forEach(r => { tekst += `${r.aantal}\t${r.bestelnummer}\t${r.naam}
`;});
    if (opmerking.trim()) tekst += `

Opmerkingen: ${opmerking.trim()}`;
    return tekst;
  };

  if (!leveranciers) return <p>Laden...</p>;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">📦 Bestellen</h1>

      <div className="flex items-center gap-4 mb-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={toonIncidenteel} onChange={e=>setToonIncidenteel(e.target.checked)} />
          Toon incidentele leveranciers
        </label>
      </div>

      <select
        className="border rounded px-3 py-2"
        value={leverancierId ?? ""}
        onChange={onSelectLeverancier}
      >
        <option value="">-- Kies leverancier --</option>
        {leveranciers
          .filter(l => toonIncidenteel ? l.soort==="incidenteel" : l.soort==="wekelijks")
          .map(l => <option key={l.id} value={l.id}>{l.naam}</option>)}
      </select>

      {leverancierId && (
        <div className="hidden md:block space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <label className="text-sm font-semibold">Referentie:</label>
            <input
              type="text"
              value={referentieSuffix}
              onChange={e=>setReferentieSuffix(e.target.value)}
              className="border px-2 py-1 rounded w-full md:w-60"
              placeholder="bijv. vrijdag"
            />
          </div>
          <div className="text-sm font-semibold">
            Totaal: €{producten?.reduce((s,p)=> s + (invoer[p.id] ?? 0) * (p.huidige_prijs ?? 0), 0).toFixed(2)}
          </div>
          <textarea
            className="w-full border px-3 py-2 rounded"
            rows={3}
            placeholder="Opmerkingen (optioneel)"
            value={opmerking}
            onChange={e=>setOpmerking(e.target.value)}
          />
          <div className="flex gap-4">
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded"
              onClick={async () => {
                const naar = prompt("Naar welk e-mailadres?", "info@ijssalonvincenzo.nl");
                if (!naar) return;

                await fetch("/api/mail/bestelling", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    naar,
                    onderwerp: `Bestelling IJssalon Vincenzo – ${leveranciers?.find(l=>l.id===leverancierId)?.naam ?? "Onbekend"} – ${referentie}`,
                    tekst: genereerTekst(),
                  }),
                });

                const response = await fetch(`/api/bestelling/historie`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ leverancier_id: leverancierId, data: invoer, referentie, opmerking }),
                });
                const result = await response.json();
                if (!response.ok) { alert("❌ Historie NIET opgeslagen:\n" + JSON.stringify(result)); return; }

                await fetch(`/api/bestelling/onderhanden?leverancier=${leverancierId}`, { method: "DELETE" });
                suppressUntilRef.current = Date.now() + 1500;
                setLoadedLeverancierId(null);
                setInvoer({});
                showSnackbar("Bestelling is gereset");
                alert("Bestelling is verzonden!");
              }}
            >
              📧 Mail bestelling
            </button>

            <button
              className="bg-red-500 text-white px-4 py-2 rounded"
              onClick={async () => {
                await fetch(`/api/bestelling/onderhanden?leverancier=${leverancierId}`, { method: "DELETE" });
                suppressUntilRef.current = Date.now() + 1500;
                setLoadedLeverancierId(null);
                setInvoer({});
                showSnackbar("Bestelling is gereset");
              }}
            >
              Reset bestelling
            </button>
          </div>
        </div>
      )}

      {leverancierId && (
        <div className="hidden md:block overflow-auto">
          <table className="w-full text-sm border mt-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">Product</th>
                <th className="p-2 text-left">Eenheid</th>
                <th className="p-2 text-left">Prijs</th>
                <th className="p-2 text-left">Aantal</th>
                <th className="p-2 text-left">Actie</th>
                {(historie ?? []).slice(0,6).map((b,i)=>(
                  <th key={i} className="p-2 text-center font-semibold" title={`Besteld op ${new Date(b.besteld_op).toLocaleDateString('nl-NL')}`}>{i+1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {producten?.sort((a,b)=>(a.volgorde ?? 999) - (b.volgorde ?? 999)).map(p=>(
                <tr key={p.id} className="border-t">
                  <td className="p-2">{p.naam}</td>
                  <td className="p-2">{p.besteleenheid ?? 1}</td>
                  <td className="p-2">{p.huidige_prijs != null ? `€ ${Number(p.huidige_prijs).toFixed(2)}` : "–"}</td>
                  <td className="p-2">
                    <input type="number" min="0" className="w-16 px-2 py-1 border rounded text-right"
                      value={invoer[p.id] ?? 0}
                      onChange={e => setAantal(p.id, isNaN(Number(e.target.value)) ? 0 : Number(e.target.value))}
                    />
                  </td>
                  <td className="p-2 space-x-2">
                    <button onClick={()=>wijzigAantal(p.id, -1)} className="px-2 py-1 bg-gray-200 rounded">–</button>
                    <button onClick={()=>wijzigAantal(p.id, 1)} className="px-2 py-1 bg-blue-600 text-white rounded">+</button>
                  </td>
                  {(historie ?? []).slice(0,6).map((b,i)=>(
                    <td key={i} className="p-2 text-center font-bold">{b.data?.[p.id] ?? '-'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {leverancierId && (
        <div className="md:hidden space-y-4">
          {producten?.map(p=>(
            <div key={p.id} className="flex items-center justify-between border-b py-2">
              <span>{p.naam}</span>
              <div className="flex items-center space-x-2">
                <button onClick={()=>wijzigAantal(p.id, -1)} className="px-2 py-1 bg-gray-200 rounded">–</button>
                <input type="number" min="0" className="w-16 px-2 py-1 border rounded text-right"
                  value={invoer[p.id] ?? 0}
                  onChange={e => setAantal(p.id, isNaN(Number(e.target.value)) ? 0 : Number(e.target.value))}
                />
                <button onClick={()=>wijzigAantal(p.id, 1)} className="px-2 py-1 bg-blue-600 text-white rounded">+</button>
              </div>
            </div>
          ))}
          <div className="flex space-x-2">
            <button className="flex-1 bg-red-500 text-white px-4 py-2 rounded"
              onClick={async () => {
                await fetch(`/api/bestelling/onderhanden?leverancier=${leverancierId}`, { method: "DELETE" });
                suppressUntilRef.current = Date.now() + 1500;
                setLoadedLeverancierId(null);
                setInvoer({});
                showSnackbar("Bestelling is gereset");
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
