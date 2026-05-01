"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  CalendarDays,
  RefreshCw,
  Save,
  UserX,
  Users,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Periode = {
  id: number;
  naam: string;
  start_datum: string;
  eind_datum: string;
};

type Item = {
  datum: string;
  shift_nr: number;
  functie: "scheppen" | "voorbereiden" | "ijsbereiden";
  aantal: number;
};

type PlanningItem = {
  id: number;
  datum: string;
  shift_nr: number;
  functie: "scheppen" | "voorbereiden" | "ijsbereiden";
  medewerker_email: string;
  naam: string;
};

const functies = ["scheppen", "voorbereiden", "ijsbereiden"] as const;

const functieLabels: Record<string, string> = {
  scheppen: "Scheppen",
  voorbereiden: "Voorbereiden",
  ijsbereiden: "IJsbereiden",
};

const functieKleur: Record<string, string> = {
  scheppen: "bg-blue-600",
  voorbereiden: "bg-orange-500",
  ijsbereiden: "bg-purple-600",
};

function formatDateNl(value: string) {
  return new Date(value + "T12:00:00").toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

export default function ZomerfeestenPlanning() {
  const [periodeId, setPeriodeId] = useState<number | null>(null);
  const [matrix, setMatrix] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const { data: periodes } = useSWR("/api/admin/planning/periodes", fetcher);

  const { data: behoefte, mutate } = useSWR(
    periodeId
      ? `/api/admin/planning/shiftbehoefte?periode_id=${periodeId}`
      : null,
    fetcher
  );

  const { data: planning, mutate: mutatePlanning } = useSWR(
    periodeId
      ? `/api/admin/planning/toewijzingen?periode_id=${periodeId}`
      : null,
    fetcher
  );

  const geselecteerde = periodes?.periodes?.find(
    (p: Periode) => p.id === periodeId
  );

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
    if (!behoefte?.items) return;

    const m: Record<string, number> = {};

    for (const item of behoefte.items) {
      const datum = String(item.datum).slice(0, 10);
      const key = `${datum}_${item.shift_nr}_${item.functie}`;
      m[key] = Number(item.aantal || 0);
    }

    setMatrix(m);
  }, [behoefte]);

  const planningPerDag = useMemo(() => {
    const out: Record<string, Record<number, Record<string, PlanningItem[]>>> =
      {};

    for (const item of planning?.items ?? []) {
      const datum = String(item.datum).slice(0, 10);

      if (!out[datum]) out[datum] = {};
      if (!out[datum][item.shift_nr]) out[datum][item.shift_nr] = {};
      if (!out[datum][item.shift_nr][item.functie]) {
        out[datum][item.shift_nr][item.functie] = [];
      }

      out[datum][item.shift_nr][item.functie].push(item);
    }

    return out;
  }, [planning]);

  function setValue(
    datum: string,
    shift: number,
    functie: string,
    value: number
  ) {
    const key = `${datum}_${shift}_${functie}`;

    setMatrix((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function opslaan() {
    if (!periodeId) return;

    setSaving(true);

    const items: Item[] = [];

    for (const datum of dagen) {
      for (const shift of [1, 2]) {
        for (const functie of functies) {
          const key = `${datum}_${shift}_${functie}`;

          items.push({
            datum,
            shift_nr: shift,
            functie,
            aantal: Number(matrix[key] || 0),
          });
        }
      }
    }

    const res = await fetch("/api/admin/planning/shiftbehoefte", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        periode_id: periodeId,
        items,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error || "Opslaan mislukt");
      return;
    }

    await mutate();
    alert("Opgeslagen");
  }

  async function genereerPlanning() {
    if (!periodeId) return;

    setGenerating(true);

    const res = await fetch("/api/admin/planning/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ periode_id: periodeId }),
    });

    setGenerating(false);

    if (res.ok) {
      await mutatePlanning();
      alert("Planning gegenereerd");
    } else {
      alert("Fout bij genereren");
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
                <CalendarDays className="h-4 w-4" />
                Planning / Zomerfeesten
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Zomerfeesten planning
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Vul de behoefte in, registreer afwezigheid en genereer daarna
                het conceptrooster.
              </p>
            </div>

            <select
              value={periodeId ?? ""}
              onChange={(e) => setPeriodeId(Number(e.target.value))}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Kies periode</option>
              {periodes?.periodes?.map((p: Periode) => (
                <option key={p.id} value={p.id}>
                  {p.naam}
                </option>
              ))}
            </select>
          </div>
        </section>

        {dagen.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Behoefte per shift
                </h2>
                <p className="text-sm text-slate-500">
                  Aantal medewerkers per dag, shift en functie.
                </p>
              </div>
            </div>

            <div className="overflow-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 text-left">Datum</th>
                    <th className="p-2">Shift</th>
                    <th className="p-2">Scheppen</th>
                    <th className="p-2">Voorbereiden</th>
                    <th className="p-2">IJsbereiden</th>
                  </tr>
                </thead>
                <tbody>
                  {dagen.map((datum) =>
                    [1, 2].map((shift) => (
                      <tr key={`${datum}_${shift}`} className="border-t">
                        <td className="p-2 font-medium text-slate-800">
                          {formatDateNl(datum)}
                        </td>
                        <td className="p-2 text-center font-semibold">
                          Shift {shift}
                        </td>

                        {functies.map((f) => {
                          const key = `${datum}_${shift}_${f}`;

                          return (
                            <td key={f} className="p-2 text-center">
                              <input
                                type="number"
                                min={0}
                                value={matrix[key] ?? 0}
                                onChange={(e) =>
                                  setValue(
                                    datum,
                                    shift,
                                    f,
                                    Number(e.target.value)
                                  )
                                }
                                className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-1 py-1 text-center outline-none focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={opslaan}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                <Save size={16} />
                {saving ? "Opslaan..." : "Opslaan"}
              </button>

              <Link
                href={`/admin/planning/afwezigheid?periode_id=${periodeId}`}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"
              >
                <UserX size={16} />
                Afwezigheid invoeren
              </Link>

              <button
                onClick={genereerPlanning}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                <RefreshCw size={16} />
                {generating ? "Genereren..." : "Genereer planning"}
              </button>
            </div>
          </section>
        )}

        {planning?.items?.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Gegenereerde planning
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {planning.items.length} geplande diensten
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                <Users size={20} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
              {dagen.map((datum) => {
                const dag = planningPerDag[datum] || {};
                const totaalDag = Object.values(dag).reduce(
                  (sum, shifts) =>
                    sum +
                    Object.values(shifts).reduce(
                      (s, items) => s + items.length,
                      0
                    ),
                  0
                );

                return (
                  <div
                    key={datum}
                    className="flex flex-col rounded-2xl border border-slate-200 bg-white p-3 text-xs leading-tight shadow-sm"
                  >
                    <div className="mb-3 flex items-baseline justify-between gap-2">
                      <h3 className="font-bold text-slate-950">
                        {formatDateNl(datum)}
                      </h3>

                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-blue-100">
                        {totaalDag} diensten
                      </span>
                    </div>

                    {[1, 2].map((shift) => {
                      const shiftData = dag[shift] || {};
                      const totaalShift = Object.values(shiftData).reduce(
                        (s, items) => s + items.length,
                        0
                      );

                      return (
                        <div key={shift} className="mb-4">
                          <div className="mb-2 rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-bold text-white">
                            Shift {shift} · {totaalShift} medewerkers
                          </div>

                          <div className="space-y-2">
                            {functies.map((functie) => {
                              const items = shiftData[functie] || [];
                              const nodig =
                                matrix[`${datum}_${shift}_${functie}`] || 0;
                              const tekort = Math.max(0, nodig - items.length);

                              if (nodig === 0 && items.length === 0) {
                                return null;
                              }

                              return (
                                <div key={functie}>
                                  <div
                                    className={`mb-1 rounded-lg px-2 py-1 text-[11px] font-bold text-white ${functieKleur[functie]}`}
                                  >
                                    {functieLabels[functie]}{" "}
                                    <span className="font-medium opacity-90">
                                      ({items.length}/{nodig})
                                    </span>
                                  </div>

                                  <ul className="space-y-1">
                                    {items.map((item) => (
                                      <li
                                            key={item.id}
                                            title={item.naam}
                                            className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-800"
                                          >
                                          <strong className="block w-full truncate text-[12px]">
                                            {item.naam}
                                          </strong>
                                      </li>
                                    ))}

                                    {Array.from({ length: tekort }).map(
                                      (_, i) => (
                                        <li
                                          key={`tekort-${functie}-${i}`}
                                          className="rounded-xl border border-red-200 bg-red-50 px-2 py-1.5 font-semibold text-red-700"
                                        >
                                          Tekort
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}