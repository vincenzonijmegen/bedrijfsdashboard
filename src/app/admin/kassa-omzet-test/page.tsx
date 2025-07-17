'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function KassaOmzetImportPage() {
  const today = new Date().toISOString().substring(0, 10);
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [status, setStatus] = useState<string>('');

  const handleImport = async () => {
    setStatus('Importeren...');
    try {
      const res = await fetch(
        `/api/rapportage/omzet/import?start=${startDate}&einde=${endDate}`,
        { method: 'POST' }
      );
      const json = await res.json();
      setStatus('Import resultaat: ' + JSON.stringify(json));
    } catch (err: any) {
      setStatus('Fout bij import: ' + err.message);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <Link href="/admin" className="text-sm underline text-blue-600">
        ← Terug naar admin
      </Link>
      <h1 className="text-2xl font-bold mt-4 mb-6">Import Omzet</h1>

      <div className="mb-4">
        <label htmlFor="start" className="block mb-1 text-sm font-medium">
          Startdatum
        </label>
        <input
          id="start"
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          className="w-full border p-2 rounded"
        />
      </div>

      <div className="mb-6">
        <label htmlFor="end" className="block mb-1 text-sm font-medium">
          Einddatum
        </label>
        <input
          id="end"
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          className="w-full border p-2 rounded"
        />
      </div>

      <button
        onClick={handleImport}
        className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
      >
        Start Import
      </button>

      {status && (
        <p className="mt-4 text-sm text-gray-800 whitespace-pre-wrap">
          {status}
        </p>
      )}
    </div>
  );
}
