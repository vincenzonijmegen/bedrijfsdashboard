"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  datum: string;     // "2025-04-18T00:00:00.000Z"
  dag: string;       // "2025-04-18"
  naam: string;      // "Goede Vrijdag"
  feestdag: string;  // alias voor naam
  omzet: string;     // "3539.00" (string uit SQL)
  aantal: number;    // 1016
};

const EUR = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

function toArray(x: any): Row[] {
  if (Array.isArray(x)) return x as Row[];
  if (Array.isArray(x?.rows)) return x.rows as Row[];
  return [];
}

export default function FeestdagOmzetPage() {
  const now = new Date();
  const [jaar, setJaar] = useState<number>(now.getFullYear());
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async (y = jaar) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/rapportage/feestdagomzet?jaar=${y}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Onbekende serverfout");
      setData(toArray(json));
    } catch (e: any) {
      setData([]);
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(jaar); /* initial + jaar-wijziging */ }, [jaar]);

  const totals = useMemo(() => {
    const tOmzet = data.reduce((s, r) => s + (Number(r.omzet) || 0), 0);
    const tAantal = data.reduce((s, r) => s + (Number(r.aantal) || 0), 0);
    return { omzet: tOmzet, aantal: tAantal };
  }, [data]);

  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, [now]);

  return (
    <div className="p-4 max-w-3xl">
      <div className="mb-3">
        <a href="/admin/rapportage" className="text-blue-600 hover:underline">&larr; Financiële Rapportages</a>
      </div>

      <h1 className="text-2xl font-bold mb-4">Omzet per feestdag</h1>

      <div className="flex items-center gap-2 mb-4">
        <label className="text-sm">Jaar</label>
        <select
          className="border rounded px-2 py-1"
          value={jaar}
          onChange={(e) => setJaar(parseInt(e.target.value, 10))}
        >
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <button
          onClick={() => load(jaar)}
          className="ml-2 border rounded px-3 py-1 text-sm hover:bg-gray-100"
          disabled={loading}
        >
          {loading ? "Laden…" : "Herladen"}
        </button>

        {err && <span className="ml-3 text-sm text-red-700">Fout: {err}</span>}
      </div>

      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-3 py-2">Datum</th>
              <th className="text-left px-3 py-2">Feestdag</th>
              <th className="text-right px-3 py-2">Omzet</th>
              <th className="text-right px-3 py-2">Aantal</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(data) ? data : []).map((r) => {
              const key = `${r.dag}-${r.naam}`;
              const omzetNum = Number(r.omzet) || 0;
              return (
                <tr key={key} className="border-t">
                  <td className="px-3 py-2">{r.dag ?? ""}</td>
                  <td className="px-3 py-2">{r.feestdag || r.naam}</td>
                  <td className="px-3 py-2 text-right">{EUR.format(Math.round(omzetNum))}</td>
                  <td className="px-3 py-2 text-right">{Number(r.aantal) || 0}</td>
                </tr>
              );
            })}

            {/* Totaalregel */}
            <tr className="border-t bg-gray-50 font-semibold">
              <td className="px-3 py-2" colSpan={2}>Totaal</td>
              <td className="px-3 py-2 text-right">{EUR.format(Math.round(totals.omzet))}</td>
              <td className="px-3 py-2 text-right">{totals.aantal}</td>
            </tr>

            {/* Leegstaat */}
            {(!loading && data.length === 0) && (
              <tr className="border-t">
                <td className="px-3 py-4 text-gray-500" colSpan={4}>
                  Geen feestdagen gevonden in {jaar}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Bron: <code>rapportage.feestdagen</code> & <code>rapportage.omzet_dag_product</code> (met fallback op ruwe omzet).
      </p>
    </div>
  );
}
