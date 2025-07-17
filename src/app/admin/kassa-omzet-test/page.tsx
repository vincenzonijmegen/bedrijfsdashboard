// src/app/admin/kassa-omzet-test/page.tsx

'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function KassaOmzetTestPage() {
  // Datum voor dagelijkse totalen
  const [singleDate, setSingleDate] = useState(() => {
    const today = new Date();
    return today.toISOString().substring(0, 10);
  });

  // Datumbereik voor periode-opvraag
  const [startDate, setStartDate] = useState('2024-07-14');
  const [endDate, setEndDate] = useState('2025-07-15');

  // Helper: format dd-mm-yyyy
  const formatDMY = (iso: string) => {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  // SWR hooks
  const { data: totalen, error: errorTotal, mutate: mutateTotal } = useSWR(
    `/api/kassa/omzet?start=${formatDMY(singleDate)}&totalen=1`,
    fetcher
  );

  const { data: rangeData, error: errorRange, mutate: mutateRange } = useSWR(
    `/api/kassa/omzet?start=${formatDMY(startDate)}&einde=${formatDMY(endDate)}`,
    fetcher
  );

  return (
    <div className="p-6">
      <Link href="/admin" className="text-sm underline text-blue-600">← Terug naar admin</Link>
      <h1 className="text-2xl font-bold mt-4 mb-4">Test Kassa Omzet API</h1>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Totale omzet per dag</h2>
        <div className="flex items-center space-x-2 mb-4">
          <label htmlFor="singleDate" className="text-sm">Datum:</label>
          <input
            id="singleDate"
            type="date"
            value={singleDate}
            onChange={e => setSingleDate(e.target.value)}
            className="border p-1"
          />
          <button
            onClick={() => mutateTotal()}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
          >Ververs</button>
        </div>
        {errorTotal && <p className="text-red-500">Error: {errorTotal.message}</p>}
        {!totalen && !errorTotal && <p>Loading...</p>}
        {totalen && (
          <pre className="bg-gray-100 p-4 rounded overflow-auto">{JSON.stringify(totalen, null, 2)}</pre>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Omzet per periode</h2>
        <div className="flex items-center space-x-2 mb-4">
          <label htmlFor="startDate" className="text-sm">Start:</label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="border p-1"
          />
          <label htmlFor="endDate" className="text-sm">Einde:</label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="border p-1"
          />
          <button
            onClick={() => mutateRange()}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
          >Ververs</button>
        </div>
        {errorRange && <p className="text-red-500">Error: {errorRange.message}</p>}
        {!rangeData && !errorRange && <p>Loading...</p>}
        {rangeData && (
          <pre className="bg-gray-100 p-4 rounded overflow-auto">{JSON.stringify(rangeData, null, 2)}</pre>
        )}
      </section>
    </div>
  );
}
