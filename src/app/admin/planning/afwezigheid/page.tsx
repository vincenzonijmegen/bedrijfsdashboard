"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Medewerker = {
  email: string;
  naam: string;
};

type Periode = {
  id: number;
  naam: string;
  start_datum: string;
  eind_datum: string;
};

type AfwezigItem = {
  medewerker_email: string;
  datum: string;
};

export default function AfwezigheidPage() {
  const [periodeId, setPeriodeId] = useState<number | null>(null);
  const [matrix, setMatrix] = useState<Record<string, boolean>>({});

  const { data: periodesData } = useSWR("/api/admin/planning/periodes", fetcher);
  const { data: medewerkersData } = useSWR("/api/admin/medewerkers", fetcher);

  const { data: afwezigData, mutate } = useSWR(
    periodeId
      ? `/api/admin/planning/afwezigheid?periode_id=${periodeId}`
      : null,
    fetcher
  );

  const periodes: Periode[] = Array.isArray(periodesData)
    ? periodesData
    : periodesData?.periodes ?? [];

  const medewerkers: Medewerker[] = Array.isArray(medewerkersData)
    ? medewerkersData
    : medewerkersData?.items ?? [];

  const afwezigItems: AfwezigItem[] = Array.isArray(afwezigData)
    ? afwezigData
    : afwezigData?.items ?? [];

  const geselecteerde = periodes.find((p) => p.id === periodeId);

  const dagen = useMemo(() => {
    if (!geselecteerde) return [];

    const start = new Date(geselecteerde.start_datum);
    const eind = new Date(geselecteerde.eind_datum);

    const arr: string[] = [];
    const d = new Date(start);

    while (d <= eind) {
      arr.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }

    return arr;
  }, [geselecteerde]);

  useEffect(() => {
    const m: Record<string, boolean> = {};

    for (const a of afwezigItems) {
      const datum = String(a.datum).slice(0, 10);
      const key = `${a.medewerker_email}_${datum}`;
      m[key] = true;
    }

    setMatrix(m);
  }, [afwezigData]);

  function toggle(email: string, datum: string) {
    const key = `${email}_${datum}`;
    setMatrix((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  async function opslaan() {
    if (!periodeId) return;

    const items: { email: string; datum: string }[] = [];

    for (const key in matrix) {
      if (matrix[key]) {
        const [email, datum] = key.split("_");
        items.push({ email, datum });
      }
    }

    const res = await fetch("/api/admin/planning/afwezigheid", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        periode_id: periodeId,
        items,
      }),
    });

    if (!res.ok) {
      alert("Opslaan mislukt.");
      return;
    }

    mutate();
    alert("Opgeslagen");
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-blue-700">Planning</p>
          <h1 className="text-2xl font-bold tracking-tight">Afwezigheid</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kruis per medewerker aan op welke dagen iemand niet beschikbaar is.
          </p>

          <div className="mt-5 max-w-sm">
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Periode
            </label>
            <select
              value={periodeId ?? ""}
              onChange={(e) =>
                setPeriodeId(e.target.value ? Number(e.target.value) : null)
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Kies periode</option>
              {periodes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.naam}
                </option>
              ))}
            </select>
          </div>
        </div>

        {dagen.length > 0 && (
          <>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-3 text-left font-bold">
                        Medewerker
                      </th>
                      {dagen.map((d) => (
                        <th
                          key={d}
                          className="border-b border-slate-200 px-3 py-3 text-center font-bold"
                        >
                          {new Date(d).toLocaleDateString("nl-NL", {
                            weekday: "short",
                            day: "numeric",
                            month: "numeric",
                          })}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {medewerkers.map((m) => (
                      <tr key={m.email} className="border-b border-slate-100">
                        <td className="sticky left-0 z-10 bg-white px-4 py-3 font-semibold">
                          {m.naam}
                        </td>

                        {dagen.map((d) => {
                          const key = `${m.email}_${d}`;
                          const actief = matrix[key];

                          return (
                            <td
                              key={d}
                              onClick={() => toggle(m.email, d)}
                              className={`cursor-pointer px-3 py-3 text-center transition ${
                                actief
                                  ? "bg-red-100 font-bold text-red-700"
                                  : "bg-white hover:bg-slate-100"
                              }`}
                            >
                              {actief ? "Afwezig" : ""}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              onClick={opslaan}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
            >
              Opslaan
            </button>
          </>
        )}
      </div>
    </div>
  );
}