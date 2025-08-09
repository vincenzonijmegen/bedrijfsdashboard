"use client";

import { useState } from "react";
import useSWR from "swr";
import { ChevronLeft, ChevronRight } from "lucide-react";

const fetcher = (u: string) => fetch(u).then(r => r.json());
const maanden = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];

type Rij = { maand: number; lonen: number; loonheffing: number; pensioenpremie: number };
type Data = { jaar: number; maanden: Rij[] };

export default function Loonkosten() {
  const now = new Date().getFullYear();
  const [jaar, setJaar] = useState<number>(now);
  const { data, mutate, isLoading } = useSWR<Data>(`/api/rapportage/loonkosten?jaar=${jaar}`, fetcher);

  async function save(veld: keyof Rij, maand: number, value: number) {
    await fetch("/api/loonkosten", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jaar, maand, [veld]: value }),
    });
    mutate();
  }

  if (isLoading || !data) return <div className="p-6">Laden…</div>;

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center gap-2">
        <button className="p-2 border rounded hover:bg-gray-50" onClick={() => setJaar(j => j - 1)}>
          <ChevronLeft />
        </button>
        <div className="text-2xl font-semibold w-24 text-center tabular-nums">{jaar}</div>
        <button className="p-2 border rounded hover:bg-gray-50" onClick={() => setJaar(j => j + 1)}>
          <ChevronRight />
        </button>
      </header>

      <div className="overflow-x-auto">
        <table className="min-w-[900px] table-auto border-collapse border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-3 py-2 text-left">maand</th>
              <th className="border px-3 py-2 text-right">lonen</th>
              <th className="border px-3 py-2 text-right">loonheffing</th>
              <th className="border px-3 py-2 text-right">pensioenpremie</th>
              <th className="border px-3 py-2 text-right">totaal</th>
            </tr>
          </thead>
          <tbody>
            {data.maanden.map((r) => {
              const totaal = (r.lonen ?? 0) + (r.loonheffing ?? 0) + (r.pensioenpremie ?? 0);
              return (
                <tr key={r.maand} className="bg-white">
                  <td className="border px-3 py-2">{maanden[r.maand - 1]}</td>

                  <td className="border px-3 py-1">
                    <NumInput
                      defaultValue={r.lonen}
                      onCommit={(v) => save("lonen", r.maand, v)}
                    />
                  </td>

                  <td className="border px-3 py-1">
                    <NumInput
                      defaultValue={r.loonheffing}
                      onCommit={(v) => save("loonheffing", r.maand, v)}
                    />
                  </td>

                  <td className="border px-3 py-1">
                    <NumInput
                      defaultValue={r.pensioenpremie}
                      onCommit={(v) => save("pensioenpremie", r.maand, v)}
                    />
                  </td>

                  <td className="border px-3 py-2 text-right tabular-nums">{totaal.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-semibold">
              <td className="border px-3 py-2 text-right">Totaal</td>
              {(() => {
                const sum = (k: keyof Rij) => data.maanden.reduce((a, r) => a + (r[k] ?? 0), 0);
                const T = sum("lonen") + sum("loonheffing") + sum("pensioenpremie");
                return (
                  <>
                    <td className="border px-3 py-2 text-right tabular-nums">{sum("lonen").toFixed(2)}</td>
                    <td className="border px-3 py-2 text-right tabular-nums">{sum("loonheffing").toFixed(2)}</td>
                    <td className="border px-3 py-2 text-right tabular-nums">{sum("pensioenpremie").toFixed(2)}</td>
                    <td className="border px-3 py-2 text-right tabular-nums">{T.toFixed(2)}</td>
                  </>
                );
              })()}
            </tr>
          </tfoot>
        </table>
      </div>
    </main>
  );
}

function NumInput({ defaultValue, onCommit }: { defaultValue: number; onCommit: (value: number) => void; }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step="0.01"
      className="w-full max-w-[160px] border rounded px-2 py-1 text-right tabular-nums"
      defaultValue={Number(defaultValue ?? 0).toFixed(2)}
      onBlur={(e) => {
        const v = Number(String(e.currentTarget.value).replace(",", "."));
        if (!Number.isFinite(v)) return;
        if (v === defaultValue) return;
        onCommit(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        if (e.key === "Escape") {
          (e.currentTarget as HTMLInputElement).value = Number(defaultValue ?? 0).toFixed(2);
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
    />
  );
}
