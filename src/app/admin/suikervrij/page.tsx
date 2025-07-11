"use client";

import { useState } from "react";

const smaken = ["Aardbei", "Mango", "Bosbes", "Chocolade", "Hazelnoot", "Cappuccino"];
const kleuren = ["Blauw", "Rood", "Groen", "Geel"];

interface Productie {
  id: number;
  smaak: string;
  datum: string;
  aantal: number;
  kleur: string;
}

let nextId = 1;

export default function SuikervrijPage() {
  const [lijst, setLijst] = useState<Productie[]>([]);
  const [smaak, setSmaak] = useState(smaken[0]);
  const [datum, setDatum] = useState(() => new Date().toISOString().substring(0, 10));
  const [aantal, setAantal] = useState(0);
  const [kleur, setKleur] = useState(kleuren[0]);

  const toevoegen = async () => {
    if (!aantal || aantal <= 0) return;
    const res = await fetch('/api/suikervrij/productie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smaak, datum, aantal, kleur })
    });
    const nieuw = await res.json();
    setLijst((prev) => [nieuw, ...prev]);
    setAantal(0);
  };
  };

  const [smakenlijst, setSmakenlijst] = useState<string[]>([]);
const [kleurenlijst, setKleurenlijst] = useState<string[]>([]);
const [nieuweSmaak, setNieuweSmaak] = useState("");
const [nieuweKleur, setNieuweKleur] = useState("");

useEffect(() => {
  fetch('/api/suikervrij/smaken').then(res => res.json()).then(setSmakenlijst);
  fetch('/api/suikervrij/kleuren').then(res => res.json()).then(setKleurenlijst);
}, []);

const voegSmaakToe = async () => {
  if (!nieuweSmaak.trim()) return;
  await fetch('/api/suikervrij/smaken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ naam: nieuweSmaak.trim() })
  });
  setNieuweSmaak("");
  const data = await fetch('/api/suikervrij/smaken').then(res => res.json());
  setSmakenlijst(data);
};

const voegKleurToe = async () => {
  if (!nieuweKleur.trim()) return;
  await fetch('/api/suikervrij/kleuren', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ naam: nieuweKleur.trim() })
  });
  setNieuweKleur("");
  const data = await fetch('/api/suikervrij/kleuren').then(res => res.json());
  setKleurenlijst(data);
};

return (
  <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Productie suikervrij ijs</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label>Smaak</label>
          <select className="w-full border rounded p-2" value={smaak} onChange={(e) => setSmaak(e.target.value)}>
            {smaken.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label>Datum</label>
          <input type="date" className="w-full border rounded p-2" value={datum} onChange={(e) => setDatum(e.target.value)} />
        </div>
        <div>
          <label>Aantal</label>
          <input type="number" className="w-full border rounded p-2" value={aantal} onChange={(e) => setAantal(parseInt(e.target.value))} />
        </div>
        <div>
          <label>Kleur sticker</label>
          <select className="w-full border rounded p-2" value={kleur} onChange={(e) => setKleur(e.target.value)}>
            {kleuren.map((k) => <option key={k}>{k}</option>)}
          </select>
        </div>
      </div>

      <button onClick={toevoegen} className="bg-blue-600 text-white px-4 py-2 rounded mb-6">
        + Toevoegen
      </button>

      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1 text-left">Smaak</th>
            <th className="border px-2 py-1 text-left">Datum</th>
            <th className="border px-2 py-1 text-left">Aantal</th>
            <th className="border px-2 py-1 text-left">Sticker</th>
          </tr>
        </thead>
        <tbody>
          {lijst.map((p) => (
            <tr key={p.id}>
              <td className="border px-2 py-1">{p.smaak}</td>
              <td className="border px-2 py-1">{p.datum}</td>
              <td className="border px-2 py-1">{p.aantal}</td>
              <td className="border px-2 py-1">{p.kleur}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
        <div>
          <h2 className="text-lg font-semibold mb-2">Smaken beheren</h2>
          <ul className="mb-2 list-disc list-inside text-sm text-gray-700">
            {smakenlijst.map((s) => <li key={s}>{s}</li>)}
          </ul>
          <input
            value={nieuweSmaak}
            onChange={(e) => setNieuweSmaak(e.target.value)}
            placeholder="Nieuwe smaak"
            className="border rounded px-2 py-1 w-full mb-2"
          />
          <button onClick={voegSmaakToe} className="bg-blue-500 text-white px-3 py-1 rounded">
            + Smaak
          </button>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Kleuren beheren</h2>
          <ul className="mb-2 list-disc list-inside text-sm text-gray-700">
            {kleurenlijst.map((k) => <li key={k}>{k}</li>)}
          </ul>
          <input
            value={nieuweKleur}
            onChange={(e) => setNieuweKleur(e.target.value)}
            placeholder="Nieuwe kleur"
            className="border rounded px-2 py-1 w-full mb-2"
          />
          <button onClick={voegKleurToe} className="bg-green-600 text-white px-3 py-1 rounded">
            + Kleur
          </button>
        </div>
      </div>
    </div>
  );
}
