"use client";

import React from "react";  // ← voeg dit toe
import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ZAxis,
} from "recharts";

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

  const maxOmzet = Math.max(...data.map(d => d.omzet), 1);

  // bereken totalen per dag (rij) en per uur (kolom)
  const dagTotalen: Record<string, number> = {};
  dagen.forEach(dag => {
    dagTotalen[dag] = uren.reduce((sum, uur) => {
      const match = data.find(d => d.dag === dag && d.uur === uur);
      return sum + (match?.omzet ?? 0);
    }, 0);
  });

  const uurTotalen: Record<string, number> = {};
  uren.forEach(uur => {
    uurTotalen[uur] = dagen.reduce((sum, dag) => {
      const match = data.find(d => d.dag === dag && d.uur === uur);
      return sum + (match?.omzet ?? 0);
    }, 0);
  });

  const grandTotal = Object.values(dagTotalen).reduce((sum, v) => sum + v, 0);

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

      {/* Tabelweergave (optioneel) */}
      {/* ... je bestaande tabel hier ... */}

      {/* Heatmap via CSS Grid met totalen */}
      {dagen.length > 0 && uren.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-2">Heatmap</h2>
          <div
            className="grid border-t border-l"
            style={{
              gridTemplateColumns: `150px repeat(${uren.length}, 1fr) 1fr`,
            }}
          >
            {/* Header-rij */}
            <div className="border-b border-r bg-gray-100 px-2 py-1"></div>
            {uren.map(uur => (
              <div
                key={uur}
                className="border-b border-r text-center text-sm px-2 py-1 bg-gray-100 whitespace-nowrap"
              >
                {uur}
              </div>
            ))}
            <div className="border-b px-2 py-1 font-semibold bg-gray-100 text-center">Totaal</div>

            {/* Data-rijen + dagtotalen */}
            {dagen.map(dag => (
              <React.Fragment key={dag}>
                {/* eerste cel: datum */}
                <div className="border-b border-r px-2 py-1 font-medium whitespace-nowrap">
                  {dag}
                </div>
                {/* omzetcellen */}
                {uren.map(uur => {
                  const match = data.find(d => d.dag === dag && d.uur === uur);
                  const omzet = match?.omzet ?? 0;
                  const alpha = omzet === 0 ? 0.05 : Math.min(1, omzet / maxOmzet);
                  const bg = omzet === 0 ? "#f0f0f0" : `rgba(13, 60, 97, ${alpha})`;
                  const color = omzet / maxOmzet > 0.6 ? "white" : "black";

                  return (
                    <div
                      key={`${dag}-${uur}`}
                      className="border-b border-r text-center text-sm px-2 py-1 font-medium"
                      style={{ backgroundColor: bg, color }}
                      title={match ? `€ ${omzet.toLocaleString("nl-NL")}` : "geen omzet"}
                    >
                      {match ? `${omzet.toLocaleString("nl-NL")}` : "-"}
                    </div>
                  );
                })}
                {/* dagtotaal */}
                <div className="border-b px-2 py-1 font-semibold text-center whitespace-nowrap">
                  {dagTotalen[dag].toLocaleString("nl-NL")}
                </div>
              </React.Fragment>
            ))}

            {/* Footer: kolomtotaal + grand total */}
            <div className="border-r px-2 py-1 font-semibold bg-gray-100 text-center">Totaal</div>
            {uren.map(uur => (
              <div
                key={`tot-${uur}`}
                className="border-r px-2 py-1 font-semibold bg-gray-100 text-center whitespace-nowrap"
              >
                {uurTotalen[uur].toLocaleString("nl-NL")}
              </div>
            ))}
            <div className="px-2 py-1 font-bold bg-gray-100 text-center whitespace-nowrap">
              {grandTotal.toLocaleString("nl-NL")}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
