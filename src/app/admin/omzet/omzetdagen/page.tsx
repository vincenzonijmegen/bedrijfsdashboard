"use client";

import useSWR from "swr";
import { useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const maandNamen = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

export default function OmzetdagenBeheer() {
  const { data: dagen, mutate } = useSWR("/api/omzetdagen", fetcher);
  const [editCell, setEditCell] = useState<{
    jaar: number;
    maand: number;
  } | null>(null);
  const [inputValue, setInputValue] = useState("");

  if (!dagen) {
    return (
      <main className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Omzetdagen laden…</p>
        </div>
      </main>
    );
  }

  const dataByJaar: Record<number, { maand: number; dagen: number }[]> = {};
  dagen.forEach((r: any) => {
    if (!dataByJaar[r.jaar]) dataByJaar[r.jaar] = [];
    dataByJaar[r.jaar].push({ maand: r.maand, dagen: r.dagen });
  });

  const alleJaren = Object.keys(dataByJaar)
    .map(Number)
    .sort((a, b) => b - a);

  async function saveCell(jaar: number, maand: number) {
    const waarde = parseInt(inputValue, 10);
    if (isNaN(waarde)) return;

    await fetch("/api/omzetdagen", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jaar, maand, dagen: waarde }),
    });

    setEditCell(null);
    setInputValue("");
    mutate();
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
            <CalendarDays className="h-4 w-4" />
            Rapportage / Omzetdagen
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Omzetdagen beheren
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Beheer het aantal omzetdagen per maand. Klik op een cel om te
            wijzigen.
          </p>
        </div>

        <div className="space-y-6">
          {alleJaren.map((jaar) => (
            <section
              key={jaar}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                <h2 className="text-lg font-bold text-slate-950">{jaar}</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] table-fixed text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {maandNamen.map((naam) => (
                        <th
                          key={naam}
                          className="border-b border-slate-200 px-3 py-3 text-center"
                        >
                          {naam}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      {maandNamen.map((_, idx) => {
                        const maand = idx + 1;
                        const rec = dataByJaar[jaar].find(
                          (d) => d.maand === maand
                        );
                        const val = rec ? rec.dagen : 0;
                        const isEditing =
                          editCell?.jaar === jaar &&
                          editCell?.maand === maand;

                        return (
                          <td
                            key={maand}
                            className="border-b border-slate-100 px-2 py-3 text-center"
                          >
                            {isEditing ? (
                              <input
                                className="mx-auto h-10 w-16 rounded-xl border border-blue-300 bg-white px-2 text-center font-semibold tabular-nums outline-none ring-4 ring-blue-100"
                                autoFocus
                                type="number"
                                value={inputValue}
                                min={0}
                                max={31}
                                onChange={(e) => setInputValue(e.target.value)}
                                onBlur={() => saveCell(jaar, maand)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveCell(jaar, maand);
                                  if (e.key === "Escape") setEditCell(null);
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditCell({ jaar, maand });
                                  setInputValue(val.toString());
                                }}
                                title="Klik om aan te passen"
                                className="mx-auto flex h-10 min-w-12 items-center justify-center rounded-xl bg-slate-50 px-3 font-bold tabular-nums text-slate-800 ring-1 ring-slate-200 transition hover:bg-blue-50 hover:text-blue-700 hover:ring-blue-200"
                              >
                                {val}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}