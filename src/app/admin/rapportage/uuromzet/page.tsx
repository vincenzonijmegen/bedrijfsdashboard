"use client";

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
        const uniekeDagen = [...new Set(rows.map(r => r.dag))];
        const uniekeUren = [...new Set(rows.map(r => r.uur))].sort();
        setDagen(uniekeDagen);
        setUren(uniekeUren);
      });
  }, [start, end]);

  const maxOmzet = Math.max(...data.map(d => d.omzet), 1); // vermijd delen door 0

  return (
    <div className="p-6 max-w-full">
      <h1 className="text-2xl font-bold mb-4">Uur-omzet per dag</h1>

      <div className="flex gap-4 items-center mb-6">
        <label>
          Van: <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="border px-2 py-1 rounded" />
        </label>
        <label>
          Tot: <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="border px-2 py-1 rounded" />
        </label>
      </div>

      <div className="overflow-auto">
        <table className="text-sm border border-collapse w-full">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th className="border px-2 py-1 text-left">Datum</th>
              {uren.map((uur) => (
                <th key={uur} className="border px-2 py-1 text-center whitespace-nowrap">{uur}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dagen.map((dag) => (
              <tr key={dag}>
                <td className="border px-2 py-1 font-medium whitespace-nowrap">{dag}</td>
                {uren.map((uur) => {
                  const match = data.find(d => d.dag === dag && d.uur === uur);
                  return (
                    <td key={uur} className="border px-2 py-1 text-right">
                      {match ? `€ ${match.omzet.toLocaleString("nl-NL")}` : "-"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-semibold mb-2">Heatmap</h2>
          <div style={{ width: "100%", overflowX: "auto" }}>
            <ResponsiveContainer width={Math.max(uren.length * 42, 400)} height={dagen.length * 35 + 60}>
              <ComposedChart
                layout="vertical"
                data={dagen.flatMap((dag) =>
                  uren.map((uur) => {
                    const match = data.find((d) => d.dag === dag && d.uur === uur);
                    return { dag, uur, omzet: match?.omzet ?? 0 };
                  })
                )}
                margin={{ top: 20, right: 20, left: 100, bottom: 20 }}
              >
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="dag" width={90} />
                <ZAxis type="number" dataKey="omzet" range={[0, maxOmzet]} />
                <Tooltip
                  formatter={(value: number) => `€ ${value.toLocaleString("nl-NL")}`}
                  labelFormatter={(label) => `Datum: ${label}`}
                />
                {dagen.flatMap((dag) =>
                  uren.map((uur) => {
                    const match = data.find((d) => d.dag === dag && d.uur === uur);
                    const omzet = match?.omzet ?? 0;
                    const kleur = omzet === 0
                      ? "#f0f0f0"
                      : `rgba(0, 123, 255, ${Math.min(1, omzet / maxOmzet)})`;

                    return (
                      <Cell
                        key={`${dag}-${uur}`}
                        fill={kleur}
                        x={uren.indexOf(uur) * 42}
                        y={dagen.indexOf(dag) * 35}
                        width={42}
                        height={35}
                      />
                    );
                  })
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
