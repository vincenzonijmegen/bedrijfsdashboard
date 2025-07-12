// Bestand: src/app/admin/rapportage/feestdagomzet/page.tsx
'use client';

import Link from 'next/link';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function FeestdagOmzetPage() {
  const { data, error } = useSWR('/api/rapportage/feestdagomzet', fetcher);

  if (error) return <div className="p-6 text-red-600">Fout bij laden van data.</div>;
  if (!data) return <div className="p-6">Bezig met laden...</div>;

  const feestdagen = (data as any[])
    .map(r => r.feestdag)
    .filter((v, i, a) => a.indexOf(v) === i) as string[];
  const jaren = (data as any[])
    .map(r => Number(r.jaar))
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => a - b) as number[];

  const perFeestdag: Record<string, Record<number, number>> = {};
  const alleWaarden: number[] = [];

  (data as any[]).forEach(({ feestdag, jaar, totaal }) => {
    perFeestdag[feestdag] = perFeestdag[feestdag] || {};
    perFeestdag[feestdag][Number(jaar)] = totaal;
    if (totaal !== null && !isNaN(totaal)) alleWaarden.push(totaal);
  });

  const min = Math.min(...alleWaarden);
  const max = Math.max(...alleWaarden);

  const getColorStyle = (value: number) => {
    if (max === min) return {};
    const pct = (value - min) / (max - min);
    const r = Math.round(255 - 155 * pct);   // pastel range
    const g = Math.round(200 + 55 * pct);
    const b = 200;
    return {
      backgroundColor: `rgb(${r},${g},${b})`,
      color: '#000',
      fontWeight: 'bold'
    } as React.CSSProperties;
  };

  return (
    <div className="p-6">
      <Link href="/admin" className="text-sm underline text-blue-600">← Terug naar admin</Link>
      <h1 className="text-2xl font-bold mt-4 mb-6">Omzet per feestdag</h1>

      <table className="border border-gray-400 text-sm leading-tight">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-1 border">Feestdag</th>
            {jaren.map(jaar => (
              <th key={jaar} className="px-2 py-1 border text-right">{jaar}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {feestdagen.map(feestdag => (
            <tr key={feestdag}>
              <td className="border p-1 font-medium whitespace-nowrap">{feestdag}</td>
              {jaren.map(jaar => {
                const val = perFeestdag[feestdag]?.[jaar] ?? 0;
                const style = val > 0 ? getColorStyle(val) : {};
                return (
                  <td key={jaar} className="border px-2 py-1 text-right" style={style}>
                    {val.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-200">
            <td className="border p-1 font-medium">Totaal per jaar</td>
            {jaren.map(jaar => {
              const totaal = feestdagen.reduce((sum, fd) => sum + (perFeestdag[fd]?.[jaar] ?? 0), 0);
              return (
                <td key={jaar} className="px-2 py-1 border text-right font-semibold">
                  {totaal.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
