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

        // Unieke dagen en uren extraheren
        const uniekeDagen = [...new Set(rows.map(r => r.dag))];
        const uniekeUren = [...new Set(rows.map(r => r.uur))].sort();
        setDagen(uniekeDagen);
        setUren(uniekeUren);
      });
  }, [start, end]);

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
    </div>
  );
}
