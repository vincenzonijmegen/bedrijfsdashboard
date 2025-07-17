// src/app/admin/kassa-omzet-test/page.tsx

'use client';

import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function KassaOmzetTestPage() {
  const { data: totalen, error: errorTotal } = useSWR(
    '/api/kassa/omzet?start=' + new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: 'numeric', year: 'numeric' }) + '&totalen=1',
    fetcher
  );

  const { data: rangeData, error: errorRange } = useSWR(
    '/api/kassa/omzet?start=14-7-2024&einde=15-7-2025',
    fetcher
  );

  return (
    <div className="p-6">
      <Link href="/admin" className="text-sm underline text-blue-600">← Terug naar admin</Link>
      <h1 className="text-2xl font-bold mt-4 mb-4">Test Kassa Omzet API</h1>

      <section className="mb-6">
        <h2 className="text-xl font-semibold">Totale omzet vandaag</h2>
        {errorTotal && <p className="text-red-500">Error: {errorTotal.message}</p>}
        {!totalen && !errorTotal && <p>Loading...</p>}
        {totalen && (
          <pre className="bg-gray-100 p-4 rounded">{JSON.stringify(totalen, null, 2)}</pre>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold">Omzet 14-7-2024 t/m 15-7-2025</h2>
        {errorRange && <p className="text-red-500">Error: {errorRange.message}</p>}
        {!rangeData && !errorRange && <p>Loading...</p>}
        {rangeData && (
          <pre className="bg-gray-100 p-4 rounded">{JSON.stringify(rangeData, null, 2)}</pre>
        )}
      </section>
    </div>
  );
}
