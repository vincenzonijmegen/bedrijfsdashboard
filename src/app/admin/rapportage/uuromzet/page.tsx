"use client";

import { useEffect, useState } from "react";

type DagUurOmzet = {
  dag: string;
  uur: string;
  omzet: number;
};

export default function UurOmzetPage() {
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<DagUurOmzet[]>([]);
  const [uren, setUren] = useState<string[]>([]);
  const [dagen, setDagen] = useState<string[]>([]);

  useEffect(() => {
    if (!start || !end) return;
    fetch(`/api/rapportage/uuromzet?start=${start}&end=${end}`)
      .then(res => res.json())
      .then((rows: DagUurOmzet[]) => {
        setData(rows);
        setDagen([...new Set(rows.map(r => r.dag))]);
        setUren([...new Set(rows.map(r => r.uur))].sort());
      });
  }, [start, end]);

  // Bepaal maximale omzet (minimaal 1 om delen door 0 te voorkomen)
  const maxOmzet = Math.max(...data.map(d => d.omzet), 1);

  // Bereken kolomtotalen en totaal van alles
  const kolomTotalen = uren.map(uur =>
    data.filter(d => d.uur === uur)
        .reduce((sum, d) => sum + d.omzet, 0)
  );
  const totaalAll = kolomTotalen.reduce((sum, v) => sum + v, 0);

  return (
    <div className="p-6 max-w-full">
      <h1 className="text-2xl font-bold mb-4">Uur-omzet per dag</h1>

      <div className="flex gap-4 items-center mb-6">
        <label>
          Van: <input
            type="date"
            value={start}
            onChange={e => setStart(e.target.value)}
            className="border px-2 py-1 rounded"
          />
        </label>
        <label>
          Tot: <input
            type="date"
            value={end}
            onChange={e => setEnd(e.target.value)}
            className="border px-2 py-1 rounded"
          />
        </label>
      </div>

      <div className="overflow-auto mb-12">
        <table className="text-sm border border-collapse w-full">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th className="border px-2 py-1 text-left">Datum</th>
              {uren.map(uur => (
                <th
                  key={uur}
                  className="border px-2 py-1 text-center whitespace-nowrap"
                >
                  {uur}
                </th>
              ))}
              <th className="border px-2 py-1 text-right whitespace-nowrap">Totaal</th>
            </tr>
          </thead>
          <tbody>
            {dagen.map(dag => {
              // Bereken per-uur-waarden
              const bedragen = uren.map(uur => {
                const found = data.find(d => d.dag === dag && d.uur === uur);
                return found ? found.omzet : 0;
              });
              // Rij-totaal
              const rijTotaal = bedragen.reduce((sum, x) => sum + x, 0);

              return (
                <tr key={dag}>
                  <td className="border px-2 py-1 font-medium whitespace-nowrap">{dag}</td>
                  {bedragen.map((omzet, idx) => (
                    <td
                      key={idx}
                      className="border px-2 py-1 text-right"
                    >
                      {omzet > 0 ? `€ ${omzet.toLocaleString('nl-NL')}` : '-'}
                    </td>
                  ))}
                  <td className="border px-2 py-1 text-right font-semibold">
                    {rijTotaal > 0 ? `€ ${rijTotaal.toLocaleString('nl-NL')}` : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-100 font-semibold">
            <tr>
              <td className="border px-2 py-1">Totaal</td>
              {kolomTotalen.map((totaal, idx) => (
                <td
                  key={idx}
                  className="border px-2 py-1 text-right"
                >
                  {totaal > 0 ? `€ ${totaal.toLocaleString('nl-NL')}` : '-'}
                </td>
              ))}
              <td className="border px-2 py-1 text-right">
                {totaalAll > 0 ? `€ ${totaalAll.toLocaleString('nl-NL')}` : '-'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Heatmap via CSS Grid */}
      {dagen.length > 0 && uren.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-2">Heatmap</h2>
          <div
            className="grid border-t border-l"
            style={{ gridTemplateColumns: `150px repeat(${uren.length}, 1fr)` }}
          >
            {/* Header */}
            <div className="border-b border-r bg-gray-100 px-2 py-1" />
            {uren.map(uur => (
              <div
                key={uur}
                className="border-b border-r text-center text-sm px-2 py-1 bg-gray-100 whitespace-nowrap"
              >
                {uur}
              </div>
            ))}

            {/* Cellen */}
            {dagen.flatMap(dag => [
              <div
                key={`${dag}-label`}
                className="border-b border-r px-2 py-1 font-medium whitespace-nowrap"
              >
                {dag}
              </div>,
              ...uren.map(uur => {
                const found = data.find(d => d.dag === dag && d.uur === uur);
                const omzet = found ? found.omzet : 0;
                const alpha = omzet === 0 ? 0.05 : Math.min(1, omzet / maxOmzet);
                const bg = omzet === 0 ? '#f0f0f0' : `rgba(13,60,97,${alpha})`;
                const kleur = omzet / maxOmzet > 0.6 ? 'white' : 'black';

                return (
                  <div
                    key={`${dag}-${uur}`}
                    className="border-b border-r text-center text-sm px-2 py-1 font-medium"
                    style={{ backgroundColor: bg, color: kleur }}
                    title={found ? `€ ${omzet.toLocaleString('nl-NL')}` : 'geen omzet'}
                  >
                    {omzet > 0 ? `€ ${omzet.toLocaleString('nl-NL')}` : '-'}
                  </div>
                );
              })
            ])}
          </div>
        </>
      )}
    </div>
  );
}
