"use client";

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

  const { data: periodes } = useSWR(
    "/api/admin/planning/periodes",
    fetcher
  );

  const { data: behoefte, mutate } = useSWR(
    periodeId
      ? `/api/admin/planning/shiftbehoefte?periode_id=${periodeId}`
      : null,
    fetcher
  );

  const geselecteerde = periodes?.periodes?.find(
    (p: Periode) => p.id === periodeId
  );

  // genereer alle dagen
  const dagen = useMemo(() => {
    if (!geselecteerde) return [];

    const start = new Date(geselecteerde.start_datum);
    const eind = new Date(geselecteerde.eind_datum);

    const arr: string[] = [];
    let d = new Date(start);

    while (d <= eind) {
      arr.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }

    return arr;
  }, [geselecteerde]);

  // laad bestaande data in matrix
  useEffect(() => {
    if (!behoefte?.items) return;

    const m: Record<string, number> = {};

    for (const item of behoefte.items) {
      const key = `${item.datum}_${item.shift_nr}_${item.functie}`;
      m[key] = item.aantal;
    }

    setMatrix(m);
  }, [behoefte]);

  function setValue(datum: string, shift: number, functie: string, value: number) {
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
            aantal: matrix[key] || 0,
          });
        }
      }
    }

    await fetch("/api/admin/planning/shiftbehoefte", {
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
    mutate();
    alert("Opgeslagen");
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Zomerfeesten planning</h1>

      <select
        value={periodeId ?? ""}
        onChange={(e) => setPeriodeId(Number(e.target.value))}
        className="border rounded px-3 py-2"
      >
        <option value="">Kies periode</option>
        {periodes?.periodes?.map((p: Periode) => (
          <option key={p.id} value={p.id}>
            {p.naam}
          </option>
        ))}
      </select>

      {dagen.length > 0 && (
        <div className="overflow-auto border rounded-xl">
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
                    <td className="p-2 text-center font-semibold">
                      {shift}
                    </td>

                    {functies.map((f) => {
                      const key = `${datum}_${shift}_${f}`;
                      return (
                        <td key={f} className="p-2 text-center">
                          <input
                            type="number"
                            value={matrix[key] ?? 0}
                            onChange={(e) =>
                              setValue(
                                datum,
                                shift,
                                f,
                                Number(e.target.value)
                              )
                            }
                            className="w-16 border rounded px-1 py-0.5 text-center"
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
        <button
          onClick={opslaan}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {saving ? "Opslaan..." : "Opslaan"}
        </button>
      )}
    </div>
  );
}