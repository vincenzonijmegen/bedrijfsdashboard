// src/app/admin/kasboek/kasstaat/page.tsx

'use client';

import useSWR from 'swr';
import { useState } from 'react';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function KasstaatPagina() {
  const [jaar, setJaar] = useState('2025');

  const { data, isLoading } = useSWR(
    `/api/kasboek/kasstaat?jaar=${jaar}`,
    fetcher
  );

  if (isLoading) return <div className="p-4">Laden...</div>;

  return (
    <div className="p-4 max-w-6xl">
      <h1 className="text-xl font-bold mb-4">Kasstaat {jaar}</h1>

      <select
        value={jaar}
        onChange={(e) => setJaar(e.target.value)}
        className="border px-2 py-1 mb-4"
      >
        <option value="2025">2025</option>
        <option value="2024">2024</option>
      </select>

      {data?.weken?.map((week: any) => (
        <div key={week.weekNr} className="mb-8 border p-4 bg-white rounded shadow">
          <h2 className="font-bold mb-2">Week {week.weekNr}</h2>

          <table className="w-full text-sm border">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-2 py-1">Categorie</th>
                <th>Ma</th>
                <th>Di</th>
                <th>Wo</th>
                <th>Do</th>
                <th>Vr</th>
                <th>Za</th>
                <th>Zo</th>
                <th>Totaal</th>
              </tr>
            </thead>

            <tbody>
              {/* ONTVANGSTEN */}
              {Object.values(week.ontvangsten).map((r: any) => (
                <tr key={r.label} className="border-t">
                  <td className="px-2 py-1">{r.label}</td>
                  {r.dagen.map((d: number, i: number) => (
                    <td key={i} className="text-right px-1">
                      {d ? d.toFixed(2) : ''}
                    </td>
                  ))}
                  <td className="text-right font-semibold">
                    {r.weekTotaal.toFixed(2)}
                  </td>
                </tr>
              ))}

              <tr className="border-t bg-gray-50 font-semibold">
                <td className="px-2 py-1">Totaal ontvangsten</td>
                <td colSpan={7}></td>
                <td className="text-right">{week.totaalOntvangsten.toFixed(2)}</td>
              </tr>

              {/* UITGAVEN */}
              {Object.values(week.uitgaven).map((r: any) => (
                <tr key={r.label} className="border-t">
                  <td className="px-2 py-1">{r.label}</td>
                  {r.dagen.map((d: number, i: number) => (
                    <td key={i} className="text-right px-1">
                      {d ? d.toFixed(2) : ''}
                    </td>
                  ))}
                  <td className="text-right font-semibold">
                    {r.weekTotaal.toFixed(2)}
                  </td>
                </tr>
              ))}

              <tr className="border-t bg-gray-50 font-semibold">
                <td className="px-2 py-1">Totaal uitgaven</td>
                <td colSpan={7}></td>
                <td className="text-right">{week.totaalUitgaven.toFixed(2)}</td>
              </tr>

              <tr className="border-t bg-yellow-50 font-bold">
                <td className="px-2 py-1">Eindsaldo kas</td>
                <td colSpan={7}></td>
                <td className="text-right">{week.eindsaldoKas.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}