"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Regel = {
  id: number;
  type: "winst_en_verlies" | "balans";
  sectie: string;
  naam: string;
  niveau: number;
  sortering: number;
  bedragen: Record<string, string | number | null>;
};

export default function JaarrekeningenPage() {
  const { data, mutate, error } = useSWR("/api/admin/jaarrekeningen", fetcher);

  const [type, setType] = useState<"winst_en_verlies" | "balans">("winst_en_verlies");
  const [nieuwJaar, setNieuwJaar] = useState("");
  const [nieuweRegel, setNieuweRegel] = useState({
    sectie: "",
    naam: "",
    niveau: 1,
    sortering: 0,
  });

  const jaren = useMemo(() => {
    const basis = data?.jaren?.length ? data.jaren : [];
    const extra = nieuwJaar ? [Number(nieuwJaar)] : [];
    return Array.from(new Set([...basis, ...extra]))
      .filter(Boolean)
      .sort((a, b) => a - b);
  }, [data, nieuwJaar]);

  const regels: Regel[] = useMemo(() => {
    return (data?.regels || []).filter((r: Regel) => r.type === type);
  }, [data, type]);

  async function slaBedragOp(regelId: number, jaar: number, bedrag: string) {
    await fetch("/api/admin/jaarrekeningen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actie: "bedrag_opslaan",
        regel_id: regelId,
        jaar,
        bedrag,
      }),
    });

    mutate();
  }

  async function voegRegelToe() {
    if (!nieuweRegel.sectie || !nieuweRegel.naam) return;

    await fetch("/api/admin/jaarrekeningen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actie: "regel_toevoegen",
        type,
        ...nieuweRegel,
      }),
    });

    setNieuweRegel({ sectie: "", naam: "", niveau: 1, sortering: 0 });
    mutate();
  }

  if (error) return <div className="p-6 text-red-600">Fout bij laden.</div>;
  if (!data) return <div className="p-6">Laden...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Link href="/admin/rapportage" className="text-sm text-blue-700 hover:underline">
            ← Terug naar rapportage
          </Link>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Jaarrekeningen</h1>
              <p className="text-sm text-slate-500">
                Historische en nieuwe jaren beheren voor W&V en balans.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setType("winst_en_verlies")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  type === "winst_en_verlies"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                Winst & verlies
              </button>
              <button
                onClick={() => setType("balans")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  type === "balans"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                Balans
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="text-sm font-semibold text-slate-700">Nieuw jaar tonen/toevoegen</label>
          <input
            value={nieuwJaar}
            onChange={(e) => setNieuwJaar(e.target.value)}
            placeholder="bijv. 2020"
            className="mt-2 w-40 rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-200">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-200 px-3 py-2 text-left">Regel</th>
                <th className="px-3 py-2 text-left">Sectie</th>
                {jaren.map((jaar: number) => (
                  <th key={jaar} className="px-3 py-2 text-right">{jaar}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regels.map((regel) => (
                <tr key={regel.id} className="border-t border-slate-200">
                  <td
                    className={`sticky left-0 bg-white px-3 py-2 ${
                      regel.niveau === 0 ? "font-bold italic text-slate-900" : "text-slate-800"
                    }`}
                  >
                    {regel.naam}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{regel.sectie}</td>
                  {jaren.map((jaar: number) => (
                    <td key={jaar} className="px-3 py-2 text-right">
                      <input
                        defaultValue={regel.bedragen?.[jaar] ?? ""}
                        onBlur={(e) => slaBedragOp(regel.id, jaar, e.target.value)}
                        className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Regel toevoegen</h2>

          <div className="grid gap-3 md:grid-cols-5">
            <input
              value={nieuweRegel.sectie}
              onChange={(e) => setNieuweRegel({ ...nieuweRegel, sectie: e.target.value })}
              placeholder="Sectie"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={nieuweRegel.naam}
              onChange={(e) => setNieuweRegel({ ...nieuweRegel, naam: e.target.value })}
              placeholder="Naam"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            />
            <input
              type="number"
              value={nieuweRegel.niveau}
              onChange={(e) => setNieuweRegel({ ...nieuweRegel, niveau: Number(e.target.value) })}
              placeholder="Niveau"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={nieuweRegel.sortering}
              onChange={(e) => setNieuweRegel({ ...nieuweRegel, sortering: Number(e.target.value) })}
              placeholder="Sortering"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={voegRegelToe}
            className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Regel toevoegen
          </button>
        </div>
      </div>
    </div>
  );
}