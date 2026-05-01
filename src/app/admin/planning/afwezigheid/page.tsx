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

export default function AfwezigheidPage() {
  const [periodeId, setPeriodeId] = useState<number | null>(null);
  const [matrix, setMatrix] = useState<Record<string, boolean>>({});

  const { data: periodes } = useSWR("/api/admin/planning/periodes", fetcher);
  const { data: medewerkers } = useSWR("/api/admin/medewerkers", fetcher);

  const { data: afwezig, mutate } = useSWR(
    periodeId
      ? `/api/admin/planning/afwezigheid?periode_id=${periodeId}`
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

  // laden
  useEffect(() => {
    if (!afwezig?.items) return;

    const m: Record<string, boolean> = {};

    for (const a of afwezig.items) {
      const datum = String(a.datum).slice(0, 10);
      const key = `${a.medewerker_email}_${datum}`;
      m[key] = true;
    }

    setMatrix(m);
  }, [afwezig]);

  function toggle(email: string, datum: string) {
    const key = `${email}_${datum}`;
    setMatrix((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  async function opslaan() {
    if (!periodeId) return;

    const items: any[] = [];

    for (const key in matrix) {
      if (matrix[key]) {
        const [email, datum] = key.split("_");
        items.push({ email, datum });
      }
    }

    await fetch("/api/admin/planning/afwezigheid", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        periode_id: periodeId,
        items,
      }),
    });

    mutate();
    alert("Opgeslagen");
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Afwezigheid</h1>

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

      {dagen.length > 0 && medewerkers && (
        <div className="overflow-auto border rounded-xl">
          <table className="text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-left">Medewerker</th>
                {dagen.map((d) => (
                  <th key={d} className="p-2">
                    {new Date(d).toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "numeric",
                    })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {medewerkers.map((m: Medewerker) => (
                <tr key={m.email} className="border-t">
                  <td className="p-2 font-medium">{m.naam}</td>

                  {dagen.map((d) => {
                    const key = `${m.email}_${d}`;
                    const actief = matrix[key];

                    return (
                      <td
                        key={d}
                        onClick={() => toggle(m.email, d)}
                        className={`p-2 text-center cursor-pointer ${
                          actief
                            ? "bg-red-200 text-red-800 font-bold"
                            : "bg-white hover:bg-slate-100"
                        }`}
                      >
                        {actief ? "X" : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dagen.length > 0 && (
        <button
          onClick={opslaan}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Opslaan
        </button>
      )}
    </div>
  );
}