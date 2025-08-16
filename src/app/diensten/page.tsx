"use client";

import { useMemo, useState } from "react";

type Dienst = {
  id: number;
  datum: string;
  rol: string;
  start_ts: string;
  eind_ts: string;
  duur_uren: number;
  bron: string;
};

type ApiResp = {
  ok: boolean;
  date: string;
  rol: string;
  dienst_count: number;
  totaal_uren: number;
  eerste_start?: string | null;
  laatste_einde?: string | null;
  diensten: Dienst[];
  error?: string;
};

function toLocal(ts?: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Vandaag in Europe/Amsterdam als YYYY-MM-DD
function todayAmsterdam(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
}

export default function DienstenPage() {
  const defaultDate = useMemo(() => todayAmsterdam(), []);
  const [date, setDate] = useState<string>(defaultDate); // direct ingevuld
  const [rol, setRol] = useState<string>("balie");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiResp | null>(null);

  const load = async () => {
    if (!date) return;
    setLoading(true);
    setErr(null);
    setData(null);
    try {
      const res = await fetch(`/api/diensten?date=${encodeURIComponent(date)}&rol=${encodeURIComponent(rol)}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as ApiResp;
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setData(json);
    } catch (e: any) {
      setErr(e?.message || "Onbekende fout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Diensten (voorstel)</h1>

      <div className="grid gap-3 md:grid-cols-4">
        <label className="flex flex-col">
          <span className="text-sm text-gray-600 mb-1">Datum</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded-lg px-3 py-2"
          />
        </label>

        <label className="flex flex-col">
          <span className="text-sm text-gray-600 mb-1">Rol</span>
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option value="balie">balie</option>
            {/* andere rollen hier */}
          </select>
        </label>

        <div className="flex items-end">
          <button
            onClick={load}
            disabled={loading || !date}
            className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
          >
            {loading ? "Laden..." : "Laden"}
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-lg border border-red-300 bg-red-50 text-red-800 p-3">
          {err}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-sm text-gray-700">
              <span className="font-medium">Datum:</span> {data.date}
            </div>
            <div className="text-sm text-gray-700">
              <span className="font-medium">Rol:</span> {data.rol}
            </div>
            <div className="text-sm text-gray-700">
              <span className="font-medium">Aantal diensten:</span> {data.dienst_count}
            </div>
            <div className="text-sm text-gray-700">
              <span className="font-medium">Totaal uren:</span> {data.totaal_uren.toFixed(2)}
            </div>
            <div className="text-sm text-gray-700">
              <span className="font-medium">Eerste start:</span> {toLocal(data.eerste_start)}
            </div>
            <div className="text-sm text-gray-700">
              <span className="font-medium">Laatste einde:</span> {toLocal(data.laatste_einde)}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-2">Start</th>
                  <th className="px-4 py-2">Einde</th>
                  <th className="px-4 py-2">Duur (uur)</th>
                  <th className="px-4 py-2">Rol</th>
                  <th className="px-4 py-2">Bron</th>
                </tr>
              </thead>
              <tbody>
                {data.diensten.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      Geen diensten gevonden voor deze dag/rol.
                    </td>
                  </tr>
                )}
                {data.diensten.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="px-4 py-2">{toLocal(d.start_ts)}</td>
                    <td className="px-4 py-2">{toLocal(d.eind_ts)}</td>
                    <td className="px-4 py-2">{d.duur_uren.toFixed(2)}</td>
                    <td className="px-4 py-2">{d.rol}</td>
                    <td className="px-4 py-2">{d.bron}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
