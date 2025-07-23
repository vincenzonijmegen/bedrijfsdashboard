"use client";

import { useEffect, useState } from "react";

type DagUurOmzet = {
  dag: string;
  uur: string;
  omzet: number;
};

export default function UurOmzetPage() {
  const [start, setStart] = useState(() => new Date().toISOString().substring(0, 10));
  const [end, setEnd] = useState(() => new Date().toISOString().substring(0, 10));
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

  // maximale omzet in de selectie (minimaal 1 om delen door 0 te voorkomen)
  const maxOmzet = Math.max(...data.map(d => d.omzet), 1);

  return (
    <div className="p-6 max-w-full">
      <h1 className="text-2xl font-bold mb-4">Uur-omzet per dag</h1>

      <div className="flex gap-4 items-center mb-6">
        <label>
          Van:{" "}
          <input
            type="date"
            value={start}
            onChange={e => setStart(e.target.value)}
            className="border px-2 py-1 rounded"
          />
        </label>
        <label>
          Tot:{" "}
          <input
            type="date"
            value={end}
            onChange={e => setEnd(e.target.value)}
            className="border px-2 py-1 rounded"
          />
        </label>
      </div>

      {/* Tabelweergave */}
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
            </tr>
          </thead>
          <tbody>
            {dagen.map(dag => (
              <tr key={dag}>
                <td className="border px-2 py-1 font-medium whitespace-nowrap">
                  {dag}
                </td>
                {uren.map(uur => {
                  const match = data.find(d => d.dag === dag && d.uur === uur);
                  return (
                    <td
                      key={uur}
                      className="border px-2 py-1 text-right"
                    >
                      {match ? `€ ${match.omzet.toLocaleString("nl-NL")}` : "-"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Heatmap via CSS Grid */}
      {dagen.length > 0 && uren.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-2">Heatmap</h2>
          <div
            className="grid border-t border-l"
            style={{
              gridTemplateColumns: `150px repeat(${uren.length}, 1fr)`,
            }}
          >
            {/* Header-rij: lege cel + uren */}
            <div className="border-b border-r bg-gray-100 px-2 py-1"></div>
            {uren.map(uur => (
              <div
                key={uur}
                className="border-b border-r text-center text-sm px-2 py-1 bg-gray-100 whitespace-nowrap"
              >
                {uur}
              </div>
            ))}

            {/* Data-cellen */}
            {dagen.map(dag =>
              // eerste kolom: dag
              [
                <div
                  key={`${dag}-label`}
                  className="border-b border-r px-2 py-1 font-medium whitespace-nowrap"
                >
                  {dag}
                </div>,
                // vervolgens uren per dag
                ...uren.map(uur => {
                  const match = data.find(d => d.dag === dag && d.uur === uur);
                  const omzet = match?.omzet ?? 0;
                  // kleurintensiteit: 0→light gray, max→dark blue
                  const alpha = omzet === 0 ? 0.05 : Math.min(1, omzet / maxOmzet);
                  const bg = omzet === 0
                    ? "#f0f0f0"
                    : `rgba(13, 60, 97, ${alpha})`;

                  return (
                    <div
                      key={`${dag}-${uur}`}
                      className="border-b border-r text-right text-sm px-2 py-1"
                      style={{ backgroundColor: bg }}
                      title={match ? `€ ${omzet.toLocaleString("nl-NL")}` : "geen omzet"}
                    >
                      {/* optioneel: toon getal in heatmap */}
                      {/* match ? omzet.toLocaleString("nl-NL") : "" */}
                    </div>
                  );
                })
              ]
            )}
          </div>
        </>
      )}
    </div>
  );
}
