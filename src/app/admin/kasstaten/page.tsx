// src/app/admin/kasstaten/page.tsx
"use client";

import { useEffect, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { v4 as uuidv4 } from "uuid";

interface Kasstaat {
  id?: string;
  datum: string;
  contant: number;
  pin: number;
  bon: number;
  cadeaubon: number;
  opmerking: string;
  totaal: number;
}

export default function KasstatenPage() {
  const [datum, setDatum] = useState(format(new Date(), "yyyy-MM-dd"));
  const [kasstaat, setKasstaat] = useState<Kasstaat | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [datum]);

  async function fetchData() {
    setLoading(true);
    const res = await fetch(`/api/kasstaten?datum=${datum}`);
    if (!res.ok) {
      setKasstaat(null);
      setLoading(false);
      return;
    }
    const json = await res.json();

    if (json === null) {
      setKasstaat({
        id: uuidv4(),
        datum,
        contant: 0.0,
        pin: 0.0,
        bon: 0.0,
        cadeaubon: 0.0,
        opmerking: "",
        totaal: 0.0,
      });
    } else {
      setKasstaat(json);
    }
    setLoading(false);
  }

  function wijzigDatum(dagen: number) {
    const nieuweDatum = format(addDays(parseISO(datum), dagen), "yyyy-MM-dd");
    setDatum(nieuweDatum);
  }

  function updateField(field: keyof Kasstaat, value: any) {
    setKasstaat(prev => prev ? { ...prev, [field]: value } : null);
  }

  async function bestaatKasstaat(datum: string): Promise<boolean> {
    const res = await fetch(`/api/kasstaten?datum=${datum}`);
    if (!res.ok) return false;
    const data = await res.json();
    return !!data;
  }

  async function opslaan() {
    if (!kasstaat) return;
    const bestaat = await bestaatKasstaat(kasstaat.datum);
    const method = bestaat ? "PUT" : "POST";
    const roundedKasstaat = {
      ...kasstaat,
      contant: parseFloat(kasstaat.contant.toFixed(2)),
      pin: parseFloat(kasstaat.pin.toFixed(2)),
      bon: parseFloat(kasstaat.bon.toFixed(2)),
      cadeaubon: parseFloat(kasstaat.cadeaubon.toFixed(2))
    };
    const res = await fetch("/api/kasstaten", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...roundedKasstaat, datum })
    });
    const json = await res.json();
    setMessage("Opgeslagen");
    setTimeout(() => setMessage(null), 3000);
    setKasstaat(json);
  }

  async function verwijderen() {
    if (!confirm("Weet je zeker dat je deze kasstaat wilt verwijderen?")) return;
    await fetch(`/api/kasstaten?datum=${datum}`, { method: "DELETE" });
    setMessage("Verwijderd");
    setKasstaat(null);
    setTimeout(() => setMessage(null), 3000);
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Kasstaat</h1>

      <div className="flex items-center space-x-2">
        <button onClick={() => wijzigDatum(-1)} className="px-2 py-1 bg-gray-200 rounded">◀</button>
        <input
          type="date"
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
          className="border px-2 py-1 rounded"
        />
        <button onClick={() => wijzigDatum(1)} className="px-2 py-1 bg-gray-200 rounded">▶</button>
      </div>

      {loading ? <p>Laden…</p> : (
        <form onSubmit={(e) => { e.preventDefault(); opslaan(); }} className="space-y-3">
          {[
            { label: "Contant geteld", field: "contant" },
            { label: "Pin uit myPOS", field: "pin" },
            { label: "Bonbetalingen", field: "bon" },
            { label: "Cadeaubon verkocht", field: "cadeaubon" },
          ].map(({ label, field }) => (
            <div key={field} className="flex justify-between">
              <label>{label}</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                className="border px-2 py-1 w-32 text-right"
                value={kasstaat?.[field as keyof Kasstaat] ?? ""}
                onChange={(e) => updateField(field as keyof Kasstaat, parseFloat(e.target.value) || 0)}
              />
            </div>
          ))}

          <div className="flex justify-between">
            <label>Opmerking</label>
            <input
              type="text"
              className="border px-2 py-1 w-full text-left"
              value={kasstaat?.opmerking ?? ""}
              onChange={(e) => updateField("opmerking", e.target.value)}
            />
          </div>

          <div className="flex justify-between font-semibold">
            <label>Totaal</label>
            <span>
              € {(Number(kasstaat?.contant ?? 0) + Number(kasstaat?.pin ?? 0) + Number(kasstaat?.bon ?? 0)).toFixed(2)}
            </span>
          </div>

          <div className="flex space-x-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Opslaan</button>
            {kasstaat && kasstaat.id && <button type="button" onClick={verwijderen} className="bg-red-600 text-white px-4 py-2 rounded">Verwijderen</button>}
          </div>
        </form>
      )}

      {message && <p className="text-green-700 font-medium">{message}</p>}
    </div>
  );
}
