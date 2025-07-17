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

  // Helper: format dd-mm-yyyy
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

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Dagomzet</h2>
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
          <div className="text-2xl font-semibold">
            € {totalen.total ?? totalen[0]?.total ?? JSON.stringify(totalen)}
          </div>
        )}
      </section>

      <Link
        href="/admin/management"
        className="inline-block bg-green-600 text-white px-4 py-2 rounded mb-4"
      >
        Ga naar Management Portaal
      </Link>

      {/* Toekomstige widgets: werkinstructies, skills, schoonmaakroutines */}
    </div>
  );
}
