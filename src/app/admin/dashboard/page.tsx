// src/app/admin/dashboard/page.tsx

'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function DashboardPage() {
  // Datum voor dagelijkse totalen
  const [singleDate, setSingleDate] = useState(() => {
    const today = new Date();
    return today.toISOString().substring(0, 10);
  });

  // Helper: format dd-mm-yyyy voor API
  const formatDMY = (iso: string) => {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  // SWR hook voor dagelijkse omzet
  const { data: totalen, error: errorTotal, mutate: mutateTotal } = useSWR(
    `/api/kassa/omzet?start=${formatDMY(singleDate)}&totalen=1`,
    fetcher
  );

  // Haal de eerste record uit het API-resultaat
  const record = Array.isArray(totalen) ? totalen[0] as Record<string, string> : null;
  const cash = record ? (parseFloat(record.Cash) || 0) : 0;
  const pin = record ? (parseFloat(record.Pin) || 0) : 0;
  const bon = record ? parseFloat(record.Bon) : 0;
  const isvoucher = record ? parseFloat(record.isvoucher) : 0;
  const total = cash + pin + bon;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Dagomzet</h2>

        {errorTotal && <p className="text-red-500 mb-4">Error: {errorTotal.message}</p>}
        {!totalen && !errorTotal && <p className="mb-4">Loading...</p>}

        {record && (
          <div className="bg-white border rounded shadow p-6 mb-6 w-full max-w-md">
            <div className="flex justify-between mb-2">
              <span>Contant</span>
              <span>€ {cash.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span>Pin</span>
              <span>€ {pin.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span>Cadeaubon</span>
              <span>€ {bon.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-bold text-lg mb-2">
              <span>TOTAAL</span>
              <span>€ {total.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Bonnen verkocht</span>
              <span>{isvoucher.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}</span>
            </div>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <label htmlFor="singleDate" className="text-sm">Datum:</label>
          <input
            id="singleDate"
            type="date"
            value={singleDate}
            onChange={e => setSingleDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
          <button
            onClick={() => mutateTotal()}
            className="bg-blue-600 text-white px-4 py-1 rounded text-sm"
          >Ververs</button>
        </div>
      </section>

      <Link
        href="/admin/management"
        className="inline-block bg-green-600 text-white px-6 py-2 rounded text-base"
      >
        Ga naar Management Portaal
      </Link>

      {/* Toekomstige widgets: werkinstructies, skills, schoonmaakroutines */}
    </div>
  );
}
