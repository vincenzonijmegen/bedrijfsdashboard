// src/app/admin/kasstaten/page.tsx
"use client";

import { useEffect, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import useSWR from "swr";

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

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function KasstatenPage() {
  const [datum, setDatum] = useState(format(new Date(), "yyyy-MM-dd"));
  const [kasstaat, setKasstaat] = useState<Kasstaat | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const formatDMY = (iso: string) => {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  const { data: kassadata } = useSWR(() => datum ? `/api/kassa/omzet?start=${formatDMY(datum)}&totalen=1` : null, fetcher);

  const record = Array.isArray(kassadata) ? kassadata[0] as Record<string, string> : null;
  const kassaContant = record ? (parseFloat(record.Cash) || 0) : 0;
  const kassaPin = record ? (parseFloat(record.Pin) || 0) : 0;
  const kassaBon = record ? (parseFloat(record.Bon) || 0) : 0;
  const kassaTotal = kassaContant + kassaPin + kassaBon;

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
      contant: parseFloat(Number(kasstaat.contant).toFixed(2)),
      pin: parseFloat(Number(kasstaat.pin).toFixed(2)),
      bon: parseFloat(Number(kasstaat.bon).toFixed(2)),
      cadeaubon: parseFloat(Number(kasstaat.cadeaubon).toFixed(2))
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
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Dagomzet</h1>

      <div className="flex items-center space-x-2 mb-4">
        <button onClick={() => wijzigDatum(-1)} className="px-2 py-1 bg-gray-200 rounded">◀</button>
        <input
          type="date"
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
          className="border px-2 py-1 rounded"
        />
        <button onClick={() => wijzigDatum(1)} className="px-2 py-1 bg-gray-200 rounded">▶</button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white shadow p-4 rounded border text-sm space-y-2">
          <h2 className="font-semibold mb-2">Geteld</h2>
          <div className="flex justify-between items-center">
            <label htmlFor="contant" className="text-sm">Contant</label>
            <input
              id="contant"
              type="number"
              step="0.01"
              inputMode="decimal"
              className="border px-2 py-1 w-32 text-right"
              value={kasstaat?.contant}
              onChange={(e) => updateField("contant", parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="flex justify-between items-center">
            <label htmlFor="pin" className="text-sm">Pin</label>
            <input
              id="pin"
              type="number"
              step="0.01"
              inputMode="decimal"
              className="border px-2 py-1 w-32 text-right"
              value={kasstaat?.pin}
              onChange={(e) => updateField("pin", parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="flex justify-between items-center">
            <label htmlFor="cadeaubon" className="text-sm">Cadeaubon</label>
            <input
              id="cadeaubon"
              type="number"
              step="0.01"
              inputMode="decimal"
              className="border px-2 py-1 w-32 text-right"
              value={kasstaat?.cadeaubon}
              onChange={(e) => updateField("cadeaubon", parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="border-t pt-2 flex justify-between font-bold">
            <span>TOTAAL</span>
            <span>€ {(Number(kasstaat?.contant ?? 0) + Number(kasstaat?.pin ?? 0) + Number(kasstaat?.bon ?? 0)).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-gray-500">
            <label htmlFor="bon" className="text-sm">Bonnen verkocht</label>
            <input
              id="bon"
              type="number"
              step="0.01"
              inputMode="decimal"
              className="border px-2 py-1 w-32 text-right"
              value={kasstaat?.bon}
              onChange={(e) => updateField("bon", parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="pt-2">
            <label className="block text-xs font-medium text-gray-500">Opmerking</label>
            <input
              type="text"
              className="w-full border rounded px-2 py-1 mt-1"
              value={kasstaat?.opmerking}
              onChange={(e) => updateField("opmerking", e.target.value)}
            />
          </div>
          <div className="flex space-x-2 pt-4">
            <button type="button" onClick={opslaan} className="bg-blue-600 text-white px-4 py-2 rounded">Opslaan</button>
            {kasstaat?.id && <button type="button" onClick={verwijderen} className="bg-red-600 text-white px-4 py-2 rounded">Verwijderen</button>}
          </div>
          {message && <p className="text-green-700 font-medium pt-2">{message}</p>}
        </div>

        <div className="bg-white shadow p-4 rounded border text-sm space-y-2">
          <h2 className="font-semibold mb-2">Kassa</h2>
          <div className="flex justify-between">
            <span>Contant</span>
            <span>€ {kassaContant.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Pin</span>
            <span>€ {kassaPin.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Cadeaubon</span>
            <span>€ {kassaBon.toFixed(2)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between font-bold">
            <span>TOTAAL</span>
            <span>€ {kassaTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
