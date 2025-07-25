// Bestand: src/app/admin/rapportage/maandomzet/page.tsx
'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import useSWR, { mutate } from 'swr';

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(res => res.json());

export default function MaandomzetPage() {
  // Forceer data-verversing bij openen
  useEffect(() => {
    mutate('/api/rapportage/maandomzet');
  }, []);

  // Ophalen via SWR
  const { data, error } = useSWR('/api/rapportage/maandomzet', fetcher, { revalidateOnMount: true });

  if (error) return <div className="p-6 text-red-600">Fout bij laden van maandomzet.</div>;
  if (!data) return <div className="p-6">Bezig met laden...</div>;

  interface Row { jaar: number; maand_start: string; totaal: number }
  const rows = data.rows as Row[];
  // zorg dat totaal numeriek is (komt als string vanuit db)
  const parsedRows = rows.map(r => ({ jaar: r.jaar, maand_start: r.maand_start, totaal: Number(r.totaal) }));
  const maxDatum = new Date(data.max_datum);

  const maandnamenMap: Record<number, string> = {
    1: 'januari', 2: 'februari', 3: 'maart', 4: 'april',
    5: 'mei', 6: 'juni', 7: 'juli', 8: 'augustus',
    9: 'september', 10: 'oktober', 11: 'november', 12: 'december'
  };

    const alleMaanden = Array.from(new Set(parsedRows.map(r => new Date(r.maand_start).getMonth() + 1)))
    .sort()
    .map(m => maandnamenMap[m]);
  const jaren = Array.from(new Set(parsedRows.map(r => r.jaar))).sort() as number[];

  const perMaand: Record<string, Record<number, number>> = {};
  const alleWaarden: number[] = [];
  parsedRows.forEach(({ jaar, maand_start, totaal }) => {
    const mIndex = new Date(maand_start).getMonth() + 1;
    const maand = maandnamenMap[mIndex];
    perMaand[maand] = perMaand[maand] || {};
    perMaand[maand][jaar] = totaal;
    alleWaarden.push(totaal);
  });

  const min = Math.min(...alleWaarden);
  const max = Math.max(...alleWaarden);
  const getColorStyle = (value: number) => {
    if (max === min) return {};
    const pct = (value - min) / (max - min);
    const r = Math.round(255 - 155 * pct);
    const g = Math.round(200 + 55 * pct);
    const b = 200;
    return { backgroundColor: `rgb(${r},${g},${b})`, color: '#000', fontWeight: 'bold' } as React.CSSProperties;
  };

  return (
    <div className="p-6">
      <Link href="/admin/rapportage" className="text-sm underline text-blue-600">← Terug naar Rapportage</Link>
      <h1 className="text-2xl font-bold mt-4 mb-2">Maandomzet per jaar</h1>
      <p className="text-sm text-gray-600 mb-4">
        Huidige jaar bijgewerkt t/m {maxDatum.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      <table className="w-full border border-gray-400 text-sm leading-tight">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-1 border">Maand</th>
            {jaren.map(j => (
              <th key={j} className="px-2 py-1 border text-right">{j}</th>
            ))}
            <th className="px-2 py-1 border text-right">Gem.</th>
          </tr>
        </thead>
        <tbody>
          {alleMaanden.map(maand => {
              const vals = jaren.map(j => perMaand[maand]?.[j] || 0);
              const avgRow = vals.length > 0 ? Math.round(vals.reduce((a,b) => a+b,0) / vals.length) : 0;
              return (
                <tr key={maand}>
                  <td className="border p-1 font-medium capitalize">{maand}</td>
                  {jaren.map(j => {
                    const val = perMaand[maand]?.[j] || 0;
                    const style = val > 0 ? getColorStyle(val) : {};
                    return (
                      <td key={j} className="border px-2 py-1 text-right" style={style}>
                        {val.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
                      </td>
                    );
                  })}
                  <td className="border px-2 py-1 text-right font-semibold">
                    {avgRow.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              );
            })}
        </tbody>
                <tfoot>
          <tr className="bg-gray-200 font-semibold">
            <td className="border p-1">Totaal per jaar</td>
            {jaren.map(j => (
              <td key={`totaal-${j}`} className="px-2 py-1 border text-right">
                {parsedRows
                  .filter(r => r.jaar === j)
                  .reduce((sum, r) => sum + r.totaal, 0)
                  .toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
              </td>
            ))}
          </tr>
          <tr className="bg-gray-200 font-semibold">
            <td className="border p-1">Gemiddelde per maand</td>
            {jaren.map(j => {
              const total = parsedRows
                .filter(r => r.jaar === j)
                .reduce((sum, r) => sum + r.totaal, 0);
              const avg = jaren.length > 0 ? Math.round(total / alleMaanden.length) : 0;
              return (
                <td key={`gem-${j}`} className="px-2 py-1 border text-right">
                  {avg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
