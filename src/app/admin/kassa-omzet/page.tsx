// src/app/admin/kassa-omzet/page.tsx
'use client';

import React, { useState, useEffect } from 'react';

export default function KassaOmzetImportPage() {
  const today = new Date().toISOString().substring(0, 10);
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [status, setStatus] = useState<string>('');
  const [lastImport, setLastImport] = useState<string | null>(null);

  // Fetch last imported date
  useEffect(() => {
    fetch('/api/rapportage/omzet/last-import')
      .then(res => {
        if (!res.ok) {
          console.error('Last-import API error:', res.status);
          throw new Error(`Status ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        console.log('Last-import data:', data);
        if (data.lastImported) {
          setLastImport(data.lastImported);
        } else {
          console.warn('lastImported ontbreekt in response');
        }
      })
      .catch(err => {
        console.error('Fout bij ophalen lastImport:', err);
      });
  }, []);

  const handleImport = async () => {
  setStatus("Importeren...");
  try {
    const res = await fetch(
      `/api/rapportage/omzet/import?start=${startDate}&einde=${endDate}`,
      { method: "POST" }
    );

    // Lees altijd als tekst, zodat we ook bij HTML/500 een nette melding tonen
    const ct = res.headers.get("content-type") || "";
    const body = await res.text();

    if (!res.ok) {
      setStatus(`❌ Fout bij import (HTTP ${res.status}): ${body.slice(0, 400)}`);
      return;
    }

    // Probeer JSON te parsen (onze route hoort JSON te geven)
    const json = ct.includes("application/json") ? JSON.parse(body) : { raw: body };

    const imported = json?.imported ?? 0;
    const upserts = json?.profiel_refresh?.upserts ?? 0;
    const range =
      json?.profiel_refresh?.range
        ? `${json.profiel_refresh.range.from}—${json.profiel_refresh.range.to}`
        : `${startDate}—${endDate}`;

    setStatus(`✅ Import OK • records: ${imported} • profiel upserts: ${upserts} • range: ${range}`);

    // Last import opnieuw ophalen
    const r2 = await fetch("/api/rapportage/omzet/last-import");
    if (r2.ok) {
      const d2 = await r2.json();
      if (d2.lastImported) setLastImport(d2.lastImported);
    }
  } catch (err: any) {
    setStatus(`Fout bij import: ${err?.message || err}`);
  }
};


  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mt-4 mb-4">Import Omzet</h1>
      {lastImport && (
        <p className="mb-4 text-sm text-gray-600">
          Laatst geïmporteerd op: <strong>{new Date(lastImport).toLocaleDateString('nl-NL')}</strong>
        </p>
      )}
      <div className="mb-4">
        <label htmlFor="start" className="block mb-1">Startdatum</label>
        <input
          id="start"
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />
      </div>
      <div className="mb-6">
        <label htmlFor="end" className="block mb-1">Einddatum</label>
        <input
          id="end"
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />
      </div>
      <button
        onClick={handleImport}
        className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
      >
        Start Import
      </button>
      {status && (
        <p className="mt-4 text-sm text-gray-800 whitespace-pre-wrap">{status}</p>
      )}
    </div>
  );
}
