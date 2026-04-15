'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';

type Row = {
  datum: string;
  dagnaam: string;
  omzet: number | string;
  is_feestdag: boolean;
  feestdag_namen: string | null;
};

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store' }).then((res) => res.json());

export default function TopOmzetdagenPage() {
  const [limit, setLimit] = useState(25);

  const { data, error, isLoading } = useSWR(
    `/api/rapportage/top-omzetdagen?limit=${limit}`,
    fetcher,
    { revalidateOnMount: true }
  );

  const rows: Row[] = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows.map((row: Row) => ({
      ...row,
      omzet: Number(row.omzet),
    }));
  }, [data]);

  if (error) {
    return <div className="p-6 text-red-600">Fout bij laden van top omzetdagen.</div>;
  }

  return (
    <div className="p-6">
      <Link href="/admin/rapportage" className="text-sm underline text-blue-600">
        ← Terug naar Rapportage
      </Link>

      <div className="mt-4 mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Top omzetdagen</h1>
          <p className="text-sm text-gray-600">
            Overzicht van de hoogste omzetdagen, inclusief feestdagmarkering uit de database.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="limit" className="text-sm font-medium">
            Toon top
          </label>
          <select
            id="limit"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded border px-3 py-2 text-sm"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div>Bezig met laden...</div>
      ) : (
        <table className="w-full border border-gray-300 text-sm leading-tight">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-2 text-right">#</th>
              <th className="border px-2 py-2 text-left">Datum</th>
              <th className="border px-2 py-2 text-left">Dag</th>
              <th className="border px-2 py-2 text-right">Omzet</th>
              <th className="border px-2 py-2 text-center">Feestdag</th>
              <th className="border px-2 py-2 text-left">Naam feestdag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const datum = new Date(row.datum);

              return (
                <tr key={`${row.datum}-${index}`} className={row.is_feestdag ? 'bg-amber-50' : ''}>
                  <td className="border px-2 py-2 text-right font-medium">{index + 1}</td>
                  <td className="border px-2 py-2">
                    {datum.toLocaleDateString('nl-NL')}
                  </td>
                  <td className="border px-2 py-2">{row.dagnaam}</td>
                  <td className="border px-2 py-2 text-right font-semibold">
                    {Number(row.omzet).toLocaleString('nl-NL', {
                      style: 'currency',
                      currency: 'EUR',
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td className="border px-2 py-2 text-center">
                    {row.is_feestdag ? 'Ja' : 'Nee'}
                  </td>
                  <td className="border px-2 py-2">
                    {row.feestdag_namen ?? '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}