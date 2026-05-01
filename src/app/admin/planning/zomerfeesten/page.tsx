"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { CalendarDays, RefreshCw, Save, UserX, Users } from "lucide-react";

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

  const { data: overzicht } = useSWR(
    periodeId
      ? `/api/admin/planning/overzicht?periode_id=${periodeId}`
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

    await fetch("/api/admin/planning/shiftbehoefte", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ periode_id: periodeId, items }),
    });

    setSaving(false);
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
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-[1700px] space-y-6">

        {/* HEADER */}
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <h1 className="text-2xl font-bold">Zomerfeesten planning</h1>
            </div>

            <select
              value={periodeId ?? ""}
              onChange={(e) => setPeriodeId(Number(e.target.value))}
              className="h-11 rounded-xl border px-3"
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

        {/* PLANNING GRID */}
        {planning?.items?.length > 0 && (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="grid grid-cols-7 gap-3">
              {dagen.map((datum) => {
                const dag = planningPerDag[datum] || {};

                return (
                  <div key={datum} className="border p-3 rounded-xl">
                    <strong>{formatDateNl(datum)}</strong>

                    {[1, 2].map((shift) => {
                      const shiftData = dag[shift] || {};

                      return (
                        <div key={shift}>
                          <div className="font-bold mt-2">Shift {shift}</div>

                          {functies.map((f) => {
                            const items = shiftData[f] || [];

                            return (
                              <div key={f}>
                                <div className="text-xs">{f}</div>

                                {items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="truncate text-sm"
                                  >
                                    {item.naam}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* OVERZICHT */}
        {overzicht?.length > 0 && (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold mb-3">
              Verdeling medewerkers
            </h2>

            <div className="grid grid-cols-4 gap-3">
              {overzicht.map((m: any) => (
                <div key={m.naam} className="border p-3 rounded-xl">
                  <div className="flex justify-between">
                    <span className="truncate">{m.naam}</span>
                    <strong>{m.totaal}</strong>
                  </div>

                  <div className="text-xs mt-2">
                    Dag: {m.shift_1} | Avond: {m.shift_2}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}