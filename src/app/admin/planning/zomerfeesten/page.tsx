"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

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

const functies = ["scheppen", "voorbereiden", "ijsbereiden"] as const;

export default function ZomerfeestenPlanning() {
  const [periodeId, setPeriodeId] = useState<number | null>(null);
  const [matrix, setMatrix] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

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

    const res = await fetch("/api/admin/planning/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ periode_id: periodeId }),
    });

if (res.ok) {
  await mutatePlanning();
  alert("Planning gegenereerd");
} else {
  alert("Fout bij genereren");
}
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Zomerfeesten planning</h1>

      <select
        value={periodeId ?? ""}
        onChange={(e) => setPeriodeId(Number(e.target.value))}
        className="rounded border px-3 py-2"
      >
        <option value="">Kies periode</option>
        {periodes?.periodes?.map((p: Periode) => (
          <option key={p.id} value={p.id}>
            {p.naam}
          </option>
        ))}
      </select>

      {dagen.length > 0 && (
        <div className="overflow-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-left">Datum</th>
                <th className="p-2">Shift</th>
                <th className="p-2">Scheppen</th>
                <th className="p-2">Voorbereiden</th>
                <th className="p-2">Ijsbereiden</th>
              </tr>
            </thead>
            <tbody>
              {dagen.map((datum) =>
                [1, 2].map((shift) => (
                  <tr key={`${datum}_${shift}`} className="border-t">
                    <td className="p-2">
                      {new Date(datum).toLocaleDateString("nl-NL")}
                    </td>
                    <td className="p-2 text-center font-semibold">{shift}</td>

                    {functies.map((f) => {
                      const key = `${datum}_${shift}_${f}`;

                      return (
                        <td key={f} className="p-2 text-center">
                          <input
                            type="number"
                            min={0}
                            value={matrix[key] ?? 0}
                            onChange={(e) =>
                              setValue(datum, shift, f, Number(e.target.value))
                            }
                            className="w-16 rounded border px-1 py-0.5 text-center"
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
      )}

      {dagen.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={opslaan}
            disabled={saving}
            className="rounded bg-blue-600 px-4 py-2 text-white"
          >
            {saving ? "Opslaan..." : "Opslaan"}
          </button>

          <Link
            href={`/admin/planning/afwezigheid?periode_id=${periodeId}`}
            className="inline-flex items-center rounded bg-orange-500 px-4 py-2 text-white"
          >
            Afwezigheid invoeren
          </Link>

          <button
            onClick={genereerPlanning}
            className="rounded bg-green-600 px-4 py-2 text-white"
          >
            Genereer planning
          </button>
        </div>
      )}
      {planning?.items?.length > 0 && (
  <div className="overflow-auto rounded-xl border bg-white">
    <div className="border-b bg-slate-100 px-4 py-3">
      <h2 className="font-semibold text-slate-900">Gegenereerde planning</h2>
    </div>

    <table className="min-w-full text-sm">
      <thead className="bg-slate-50">
        <tr>
          <th className="p-2 text-left">Datum</th>
          <th className="p-2 text-center">Shift</th>
          <th className="p-2 text-left">Functie</th>
          <th className="p-2 text-left">Medewerker</th>
        </tr>
      </thead>
      <tbody>
        {planning.items.map(
          (item: {
            id: number;
            datum: string;
            shift_nr: number;
            functie: string;
            naam: string;
          }) => (
            <tr key={item.id} className="border-t">
              <td className="p-2">
                {new Date(item.datum).toLocaleDateString("nl-NL")}
              </td>
              <td className="p-2 text-center font-semibold">
                {item.shift_nr}
              </td>
              <td className="p-2 capitalize">{item.functie}</td>
              <td className="p-2">{item.naam}</td>
            </tr>
          )
        )}
      </tbody>
    </table>
  </div>
)}
    </div>
  );
}