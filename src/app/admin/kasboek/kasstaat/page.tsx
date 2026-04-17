'use client';



import useSWR from 'swr';
import { useState } from 'react';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(json?.error || `HTTP ${res.status}`);
  }

  return json;
};

const euro = (n: number) =>
  new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(n || 0);

export default function KasstaatPagina() {
  const [jaar, setJaar] = useState('2025');

  const { data, error, isLoading } = useSWR(
    `/api/kasboek/kasstaat?jaar=${jaar}`,
    fetcher
  );

  return (
    <div className="p-4 max-w-6xl">
<div className="flex items-center justify-between mb-4">
  <h1 className="text-xl font-bold">Kasstaat {jaar}</h1>

  <button
    onClick={() =>
      window.open(`/api/kasboek/kasstaat/export?jaar=${jaar}`, '_blank')
    }
    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
  >
    Download Excel
  </button>
</div>

      <select
        value={jaar}
        onChange={(e) => setJaar(e.target.value)}
        className="border px-2 py-1 mb-4"
      >
        <option value="2025">2025</option>
        <option value="2024">2024</option>
        <option value="2023">2023</option>
      </select>

      {isLoading && (
        <div className="p-3 rounded bg-gray-100 border">
          Kasstaat wordt geladen...
        </div>
      )}

      {error && (
        <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700">
          Fout bij ophalen: {error.message}
        </div>
      )}

      {!isLoading && !error && (!data || !Array.isArray(data.weken) || data.weken.length === 0) && (
        <div className="p-3 rounded bg-yellow-50 border border-yellow-200 text-yellow-800">
          Geen kasstaat-data gevonden voor {jaar}.
        </div>
      )}

      {!isLoading && !error && data?.totalen && (
        <div className="mb-6 rounded border bg-white p-4 shadow-sm">
          <h2 className="font-semibold mb-2">Jaaroverzicht</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-gray-500">Beginsaldo kas</div>
              <div className="font-semibold">{euro(data.totalen.beginsaldoKas)}</div>
            </div>
            <div>
              <div className="text-gray-500">Totaal ontvangsten</div>
              <div className="font-semibold">{euro(data.totalen.totaalOntvangsten)}</div>
            </div>
            <div>
              <div className="text-gray-500">Totaal uitgaven</div>
              <div className="font-semibold">{euro(data.totalen.totaalUitgaven)}</div>
            </div>
            <div>
              <div className="text-gray-500">Eindsaldo kas</div>
              <div className="font-semibold">{euro(data.totalen.eindsaldoKas)}</div>
            </div>
          </div>
        </div>
      )}

      {!isLoading &&
        !error &&
        Array.isArray(data?.weken) &&
        data.weken.map((week: any) => (
          <div
            key={`${week.isoJaar}-${week.weekNr}`}
            className="mb-8 border p-4 bg-white rounded shadow"
          >
            <h2 className="font-bold mb-3">Week {week.weekNr}</h2>

            <table className="w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left px-2 py-1">Categorie</th>
                  <th className="text-right px-2 py-1">Ma</th>
                  <th className="text-right px-2 py-1">Di</th>
                  <th className="text-right px-2 py-1">Wo</th>
                  <th className="text-right px-2 py-1">Do</th>
                  <th className="text-right px-2 py-1">Vr</th>
                  <th className="text-right px-2 py-1">Za</th>
                  <th className="text-right px-2 py-1">Zo</th>
                  <th className="text-right px-2 py-1">Totaal</th>
                </tr>
              </thead>

              <tbody>
                <tr className="bg-blue-50 font-semibold border-t">
                  <td className="px-2 py-1">Beginsaldo kas</td>
                  <td colSpan={7}></td>
                  <td className="text-right px-2 py-1">{euro(week.beginsaldoKas)}</td>
                </tr>

                {Object.values(week.ontvangsten || {}).map((r: any) => (
                  <tr key={`ont-${r.label}`} className="border-t">
                    <td className="px-2 py-1">{r.label}</td>
                    {r.dagen.map((d: number, i: number) => (
                      <td key={i} className="text-right px-2 py-1">
                        {d ? euro(d) : ''}
                      </td>
                    ))}
                    <td className="text-right px-2 py-1 font-semibold">
                      {euro(r.weekTotaal)}
                    </td>
                  </tr>
                ))}

                <tr className="border-t bg-gray-50 font-semibold">
                  <td className="px-2 py-1">Totaal ontvangsten</td>
                  <td colSpan={7}></td>
                  <td className="text-right px-2 py-1">
                    {euro(week.totaalOntvangsten)}
                  </td>
                </tr>

                {Object.values(week.uitgaven || {}).map((r: any) => (
                  <tr key={`uit-${r.label}`} className="border-t">
                    <td className="px-2 py-1">{r.label}</td>
                    {r.dagen.map((d: number, i: number) => (
                      <td key={i} className="text-right px-2 py-1">
                        {d ? euro(d) : ''}
                      </td>
                    ))}
                    <td className="text-right px-2 py-1 font-semibold">
                      {euro(r.weekTotaal)}
                    </td>
                  </tr>
                ))}

                <tr className="border-t bg-gray-50 font-semibold">
                  <td className="px-2 py-1">Totaal uitgaven</td>
                  <td colSpan={7}></td>
                  <td className="text-right px-2 py-1">
                    {euro(week.totaalUitgaven)}
                  </td>
                </tr>

                <tr className="border-t bg-yellow-50 font-bold">
                  <td className="px-2 py-1">Eindsaldo kas</td>
                  <td colSpan={7}></td>
                  <td className="text-right px-2 py-1">{euro(week.eindsaldoKas)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}

      {!isLoading && !error && data && (
        <pre className="mt-6 p-3 bg-gray-100 rounded text-xs overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}