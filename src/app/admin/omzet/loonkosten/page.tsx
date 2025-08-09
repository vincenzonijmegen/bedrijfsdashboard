"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { ChevronLeft, ChevronRight } from "lucide-react";

const fetcher = (u: string) => fetch(u).then(r => r.json());
const maandenKort = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];

type Rij = { maand: number; lonen: number; loonheffing: number; pensioenpremie: number };
type Data = { jaar: number; maanden: Rij[] } | Rij[]; // ondersteunt ook oude GET (alle jaren)

export default function Loonkosten() {
  const current = new Date().getFullYear();
  const [jaar, setJaar] = useState<number>(current);

  // SWR: nieuwe (GET ?jaar=YYYY). Als je oude route nog gebruikt die alles retourneert,
  // vangen we dat op in useEffect hieronder.
  const { data, isLoading, mutate } = useSWR<Data>(`/api/loonkosten?jaar=${jaar}`, fetcher);

  // lokale draft state (bewerkbare kopie)
  const [draft, setDraft] = useState<Rij[] | null>(null);
  const [saving, setSaving] = useState(false);

  // normalize data → 12 maanden voor gekozen jaar
  useEffect(() => {
    if (!data) return;

    // Als data de nieuwe vorm { jaar, maanden } is:
    if (Array.isArray((data as any).maanden)) {
      const d = (data as any).maanden as Rij[];
      setDraft(fill12(d));
      return;
    }

    // Anders: oude vorm (alle rijen). Filter op jaar.
    const alle = data as Rij[] & { jaar?: number }[];
    const vanJaar = alle
      .filter((r: any) => Number((r as any).jaar) === jaar)
      .map((r: any) => ({
        maand: Number(r.maand),
        lonen: Number(r.lonen ?? 0),
        loonheffing: Number(r.loonheffing ?? 0),
        pensioenpremie: Number(r.pensioenpremie ?? 0),
      }));
    setDraft(fill12(vanJaar));
  }, [data, jaar]);

  const totals = useMemo(() => {
    if (!draft) return { lonen: 0, loonheffing: 0, pensioenpremie: 0, totaal: 0 };
    const sum = (k: keyof Rij) => draft.reduce((a, r) => a + (r[k] ?? 0), 0);
    const lonen = sum("lonen");
    const loonheffing = sum("loonheffing");
    const pensioenpremie = sum("pensioenpremie");
    return { lonen, loonheffing, pensioenpremie, totaal: lonen + loonheffing + pensioenpremie };
  }, [draft]);

  const dirty = useDirtyFlag(data, draft, jaar);

  function setCell(maand: number, key: keyof Rij, value: number) {
    setDraft(prev => {
      if (!prev) return prev;
      return prev.map(r => (r.maand === maand ? { ...r, [key]: value } : r));
    });
  }

  async function saveAll() {
    if (!draft) return;
    setSaving(true);
    try {
      // 12 upserts via bestaande POST /api/loonkosten
      for (const r of draft) {
        await fetch("/api/loonkosten", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jaar,
            maand: r.maand,
            lonen: r.lonen ?? 0,
            loonheffing: r.loonheffing ?? 0,
            pensioenpremie: r.pensioenpremie ?? 0,
          }),
        });
      }
      await mutate();
    } finally {
      setSaving(false);
    }
  }

  function resetDraft() {
    // herlaad vanaf server
    mutate();
  }

  if (isLoading || !draft) return <div className="p-6">Laden…</div>;

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center gap-2">
        <button
          className="p-2 border rounded hover:bg-gray-50"
          onClick={() => setJaar(j => j - 1)}
          disabled={saving}
          title="Vorig jaar"
        >
          <ChevronLeft />
        </button>
        <div className="text-2xl font-semibold w-24 text-center tabular-nums">{jaar}</div>
        <button
          className="p-2 border rounded hover:bg-gray-50"
          onClick={() => setJaar(j => j + 1)}
          disabled={saving}
          title="Volgend jaar"
        >
          <ChevronRight />
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            className="px-3 py-2 rounded border hover:bg-gray-50 disabled:opacity-50"
            onClick={resetDraft}
            disabled={!dirty || saving}
            title="Wijzigingen verwerpen"
          >
            Herstel
          </button>
          <button
            className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={saveAll}
            disabled={!dirty || saving}
            title="Alles opslaan"
          >
            {saving ? "Bezig met opslaan…" : "Opslaan"}
          </button>
        </div>
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
            {draft.map((r) => {
              const totaal = (r.lonen ?? 0) + (r.loonheffing ?? 0) + (r.pensioenpremie ?? 0);
              return (
                <tr key={r.maand} className="bg-white">
                  <td className="border px-3 py-2">{maandenKort[r.maand - 1]}</td>

                  <td className="border px-3 py-1">
                    <NumInput
                      value={r.lonen ?? 0}
                      onChange={(v) => setCell(r.maand, "lonen", v)}
                    />
                  </td>

                  <td className="border px-3 py-1">
                    <NumInput
                      value={r.loonheffing ?? 0}
                      onChange={(v) => setCell(r.maand, "loonheffing", v)}
                    />
                  </td>

                  <td className="border px-3 py-1">
                    <NumInput
                      value={r.pensioenpremie ?? 0}
                      onChange={(v) => setCell(r.maand, "pensioenpremie", v)}
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
              <td className="border px-3 py-2 text-right tabular-nums">{totals.lonen.toFixed(2)}</td>
              <td className="border px-3 py-2 text-right tabular-nums">{totals.loonheffing.toFixed(2)}</td>
              <td className="border px-3 py-2 text-right tabular-nums">{totals.pensioenpremie.toFixed(2)}</td>
              <td className="border px-3 py-2 text-right tabular-nums">{totals.totaal.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </main>
  );
}

/* Helpers */

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState<string>(value.toFixed(2));
  useEffect(() => { setText(value.toFixed(2)); }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      className="w-full max-w-[160px] border rounded px-2 py-1 text-right tabular-nums"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseLocaleNumber(e.target.value);
        if (Number.isFinite(v)) onChange(v);
      }}
      onBlur={() => {
        const v = parseLocaleNumber(text);
        setText(Number.isFinite(v) ? (v as number).toFixed(2) : value.toFixed(2));
      }}
    />
  );
}

function parseLocaleNumber(s: string): number {
  // accepteert "1.234,56" en "1234.56"
  const cleaned = s.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const v = Number(cleaned);
  return v;
}

function fill12(partial: Rij[]): Rij[] {
  const map = new Map(partial.map(r => [r.maand, r]));
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const r = map.get(m);
    return r ?? { maand: m, lonen: 0, loonheffing: 0, pensioenpremie: 0 };
  });
}

function useDirtyFlag(data: Data | undefined, draft: Rij[] | null, jaar: number) {
  if (!draft || !data) return false;

  // vergelijk met serverdata voor huidig jaar
  let server: Rij[] = [];
  if (Array.isArray((data as any).maanden)) {
    server = (data as any).maanden as Rij[];
  } else {
    const alle = data as any[];
    server = alle
      .filter((r: any) => Number(r.jaar) === jaar)
      .map((r: any) => ({
        maand: Number(r.maand),
        lonen: Number(r.lonen ?? 0),
        loonheffing: Number(r.loonheffing ?? 0),
        pensioenpremie: Number(r.pensioenpremie ?? 0),
      }));
  }
  server = fill12(server);

  const eq = (a: Rij[], b: Rij[]) =>
    a.every((r, i) =>
      r.maand === b[i].maand &&
      (r.lonen ?? 0) === (b[i].lonen ?? 0) &&
      (r.loonheffing ?? 0) === (b[i].loonheffing ?? 0) &&
      (r.pensioenpremie ?? 0) === (b[i].pensioenpremie ?? 0)
    );

  return !eq(draft, server);
}
