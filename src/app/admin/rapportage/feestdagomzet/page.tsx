// Bestand: src/app/admin/rapportage/feestdagomzet/page.tsx
'use client';

import Link from 'next/link';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function FeestdagOmzetPage() {
  const { data, error } = useSWR('/api/rapportage/feestdagomzet', fetcher);

  if (error) return <div className="p-6 text-red-600">Fout bij laden van data.</div>;
  if (!data) return <div className="p-6">Bezig met laden...</div>;

  const feestdagen = [...new Set(data.map((r: any) => r.feestdag))] as string[];
  const jaren = [...new Set(data.map((r: any) => r.jaar))].sort() as number[];

  const perFeestdag: Record<string, Record<number, number>> = {};
  const alleWaarden: number[] = [];

  data.forEach(({ feestdag, jaar, totaal }: any) => {
    perFeestdag[feestdag] = perFeestdag[feestdag] || {};
    perFeestdag[feestdag][jaar] = totaal;
    if (totaal !== null && typeof totaal === 'number') alleWaarden.push(totaal);
  });

  const min = Math.min(...alleWaarden);
  const max = Math.max(...alleWaarden);

  const getColorStyle = (value: number) => {
    if (max === min) return {};
    
  };
    const pct = (value - min) / (max - min);
    const rStart = 255, gStart = 200, b = 200;
    const rEnd = 200, gEnd = 255;
    const r = Math.round(rStart + (rEnd - rStart) * pct);
    const g = Math.round(gStart + (gEnd - gStart) * pct);
    return {
      backgroundColor: `rgb(${r},${g},${b})`,
      color: '#000',
      fontWeight: 'bold'
    };
  };
    const pct = (value - min) / (max - min);
    const r = Math.round(255 - 255 * pct);
    const g = Math.round(255 * pct);
    return {
      backgroundColor: `rgb(${r},${g},180)`,
      color: '#000',
      fontWeight: 'bold'
    };
  };

  return (
    <div className="p-6">
      <Link href="/admin" className="text-sm underline text-blue-600">← Terug naar admin</Link>
      <h1 className="text-2xl font-bold mt-4 mb-6">Omzet per feestdag</h1>

      <table className="border border-gray-400 text-sm leading-tight">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-1 border">Feestdag</th>
            {jaren.map((jaar) => (
              <th key={jaar} className="p-1 border text-right">{jaar}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {feestdagen.map((feestdag) => (
            <tr key={feestdag}>
              <td className="border p-1 font-medium whitespace-nowrap">{feestdag}</td>
              {jaren.map((jaar) => {
                const val = perFeestdag[feestdag]?.[jaar];
                const style = typeof val === 'number' ? getColorStyle(val) : {};
                return (
                  <td key={jaar} className="border p-1 text-right" style={style} title={val?.toString()}>
                    {val?.toLocaleString('nl-NL', { maximumFractionDigits: 0 }) || ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
