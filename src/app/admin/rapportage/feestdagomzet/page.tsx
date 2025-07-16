// Bestand: src/app/admin/rapportage/feestdagomzet/page.tsx
'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useState } from 'react';

interface HourlyData { hour: string; omzet: number; }
interface FeestData { feestdag: string; jaar: number; totaal: number; datum: string; }

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(res => res.json());

export default function FeestdagOmzetPage() {
  const { data, error } = useSWR<FeestData[]>('/api/rapportage/feestdagomzet', fetcher, { revalidateOnMount: true });
  const [tooltipData, setTooltipData] = useState<HourlyData[]>([]);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  if (error) return <div className="p-6 text-red-600">Fout bij laden van data.</div>;
  if (!data) return <div className="p-6">Bezig met laden...</div>;

  const feestdagen = Array.from(new Set(data.map(r => r.feestdag)));
  const jaren = Array.from(new Set(data.map(r => r.jaar))).sort();

  const perFeestdag: Record<string, Record<number, { totaal: number; datum: string }>> = {};
  const alleWaarden: number[] = [];
  data.forEach(r => {
    perFeestdag[r.feestdag] = perFeestdag[r.feestdag] || {};
    perFeestdag[r.feestdag][r.jaar] = { totaal: r.totaal, datum: r.datum };
    alleWaarden.push(r.totaal);
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

  const handleMouseEnter = async (datum: string) => {
    setHoverDate(datum);
    const hourly: HourlyData[] = await fetcher(`/api/rapportage/feestdagomzet?datum=${datum}`);
    setTooltipData(hourly);
  };
  const handleMouseLeave = () => {
    setHoverDate(null);
    setTooltipData([]);
  };

  return (
    <div className="p-6 relative">
      <Link href="/admin/rapportage" className="text-sm underline text-blue-600">← Terug naar Rapportage</Link>
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
                const cell = perFeestdag[feestdag][jaar];
                const val = cell?.totaal ?? 0;
                const datum = cell?.datum;
                const style = val > 0 ? getColorStyle(val) : {};
                return (
                  <td
                    key={jaar}
                    className="border px-2 py-1 text-right relative"
                    style={style}
                    onMouseEnter={() => datum && handleMouseEnter(datum)}
                    onMouseLeave={handleMouseLeave}
                  >
                    {val.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
                    {hoverDate === datum && (
                      <div className="absolute z-10 bg-white border p-2 shadow-lg top-full mt-1 right-0 w-48">
                        <div className="text-xs font-semibold mb-1">Verdeling per uur:</div>
                        <ul className="text-xs space-y-0.5">
                          {tooltipData.map(h => (
                            <li key={h.hour} className="flex justify-between">
                              <span>{h.hour.replace(/:00$/, '')}h</span>
                              <span>{h.omzet.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
