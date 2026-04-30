"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Save,
  WalletCards,
} from "lucide-react";

const fetcher = (u: string) =>
  fetch(u).then((r) => {
    if (!r.ok) throw new Error("Fout bij ophalen");
    return r.json();
  });

const maandenKort = [
  "jan",
  "feb",
  "mrt",
  "apr",
  "mei",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];

type Rij = {
  maand: number;
  lonen: number;
  loonheffing: number;
  pensioenpremie: number;
};

type Data = { jaar: number; maanden: Rij[] } | Rij[];

export default function Loonkosten() {
  const current = new Date().getFullYear();
  const [jaar, setJaar] = useState<number>(current);
  const [draft, setDraft] = useState<Rij[] | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<Data>(
    `/api/rapportage/loonkosten?jaar=${jaar}`,
    fetcher
  );

  useEffect(() => {
    if (!data) return;

    if (Array.isArray((data as any).maanden)) {
      setDraft(fill12((data as any).maanden as Rij[]));
      return;
    }

    const alle = data as (Rij & { jaar?: number })[];
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

    const sum = (k: keyof Rij) =>
      draft.reduce((a, r) => a + Number(r[k] ?? 0), 0);

    const lonen = sum("lonen");
    const loonheffing = sum("loonheffing");
    const pensioenpremie = sum("pensioenpremie");

    return {
      lonen,
      loonheffing,
      pensioenpremie,
      totaal: lonen + loonheffing + pensioenpremie,
    };
  }, [draft]);

  const dirty = useDirtyFlag(data, draft, jaar);

  function setCell(maand: number, key: keyof Rij, value: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      return prev.map((r) => (r.maand === maand ? { ...r, [key]: value } : r));
    });
  }

  async function saveAll() {
    if (!draft || !data) return;

    setSaving(true);

    try {
      let server: Rij[] = [];

      if ((data as any).maanden) {
        server = (data as any).maanden as Rij[];
      } else {
        const alle = data as any[];
        server = alle
          .filter((r: any) => Number(r.jaar) === jaar)
          .map((r: any) => ({
            maand: +r.maand,
            lonen: +r.lonen || 0,
            loonheffing: +r.loonheffing || 0,
            pensioenpremie: +r.pensioenpremie || 0,
          }));
      }

      server = fill12(server);

      const changed = draft.filter(
        (r, i) =>
          r.lonen !== server[i].lonen ||
          r.loonheffing !== server[i].loonheffing ||
          r.pensioenpremie !== server[i].pensioenpremie
      );

      await Promise.all(
        changed.map((r) =>
          fetch("/api/rapportage/loonkosten", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jaar,
              maand: r.maand,
              lonen: r.lonen ?? 0,
              loonheffing: r.loonheffing ?? 0,
              pensioenpremie: r.pensioenpremie ?? 0,
            }),
          })
        )
      );

      await mutate();
    } finally {
      setSaving(false);
    }
  }

  function resetDraft() {
    mutate();
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
          Fout bij laden loonkosten.
        </div>
      </main>
    );
  }

  if (isLoading || !draft) {
    return (
      <main className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Loonkosten laden…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
                <WalletCards className="h-4 w-4" />
                Rapportage / Loonkosten
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Loonkosten
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Vul maandelijkse lonen, loonheffing en pensioenpremie in.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              <StatCard label="Lonen" value={fmtEuro(totals.lonen)} />
              <StatCard label="Totaal" value={fmtEuro(totals.totaal)} green />
            </div>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                onClick={() => setJaar((j) => j - 1)}
                disabled={saving}
                title="Vorig jaar"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="w-28 text-center text-2xl font-bold tabular-nums text-slate-950">
                {jaar}
              </div>

              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                onClick={() => setJaar((j) => j + 1)}
                disabled={saving}
                title="Volgend jaar"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                onClick={resetDraft}
                disabled={!dirty || saving}
              >
                <RotateCcw size={15} />
                Herstel
              </button>

              <button
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                onClick={saveAll}
                disabled={!dirty || saving}
              >
                <Save size={15} />
                {saving ? "Opslaan…" : "Opslaan"}
              </button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">
              Maandbedragen {jaar}
            </h2>
            <p className="text-sm text-slate-500">
              Bedragen zijn hele euro’s, zonder decimalen.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 text-left">
                    Maand
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right">
                    Lonen
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right">
                    Loonheffing
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right">
                    Pensioenpremie
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right">
                    Totaal
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {draft.map((r) => {
                  const totaal =
                    (r.lonen ?? 0) +
                    (r.loonheffing ?? 0) +
                    (r.pensioenpremie ?? 0);

                  return (
                    <tr key={r.maand} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold capitalize text-slate-950">
                        {maandenKort[r.maand - 1]}
                      </td>

                      <td className="px-4 py-2">
                        <IntInput
                          value={r.lonen ?? 0}
                          onChange={(v) => setCell(r.maand, "lonen", v)}
                        />
                      </td>

                      <td className="px-4 py-2">
                        <IntInput
                          value={r.loonheffing ?? 0}
                          onChange={(v) =>
                            setCell(r.maand, "loonheffing", v)
                          }
                        />
                      </td>

                      <td className="px-4 py-2">
                        <IntInput
                          value={r.pensioenpremie ?? 0}
                          onChange={(v) =>
                            setCell(r.maand, "pensioenpremie", v)
                          }
                        />
                      </td>

                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-950">
                        {fmtInt(totaal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="bg-blue-50 font-bold text-blue-950">
                  <td className="px-4 py-3 text-right">Totaal</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmtInt(totals.lonen)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmtInt(totals.loonheffing)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmtInt(totals.pensioenpremie)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmtInt(totals.totaal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  green = false,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div
      className={`rounded-xl px-4 py-3 ring-1 ${
        green
          ? "bg-emerald-50 ring-emerald-100"
          : "bg-blue-50 ring-blue-100"
      }`}
    >
      <div
        className={`text-xs font-medium uppercase tracking-wide ${
          green ? "text-emerald-600" : "text-blue-600"
        }`}
      >
        {label}
      </div>
      <div
        className={`text-2xl font-bold ${
          green ? "text-emerald-950" : "text-blue-950"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function IntInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState<string>(
    String(Number.isFinite(value) ? value : 0)
  );

  useEffect(() => {
    setText(String(Number.isFinite(value) ? value : 0));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="\d*"
      className="ml-auto block h-10 w-full max-w-[160px] rounded-xl border border-slate-200 bg-white px-3 text-right tabular-nums outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
      value={text}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/[^\d]/g, "");
        setText(cleaned);

        if (cleaned === "") {
          onChange(0);
        } else {
          const v = parseInt(cleaned, 10);
          if (Number.isFinite(v)) onChange(v);
        }
      }}
      onBlur={() => {
        setText((prev) => (prev === "" ? "0" : String(parseInt(prev, 10))));
      }}
    />
  );
}

const fmtInt = (n: number) => String(Math.trunc(n || 0));
const fmtEuro = (n: number) => `€ ${fmtInt(n)}`;

function fill12(partial: Rij[]): Rij[] {
  const map = new Map(partial.map((r) => [r.maand, r]));

  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const r = map.get(m);

    return (
      r ?? {
        maand: m,
        lonen: 0,
        loonheffing: 0,
        pensioenpremie: 0,
      }
    );
  });
}

function useDirtyFlag(data: Data | undefined, draft: Rij[] | null, jaar: number) {
  if (!draft || !data) return false;

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

  return !draft.every(
    (r, i) =>
      r.maand === server[i].maand &&
      (r.lonen ?? 0) === (server[i].lonen ?? 0) &&
      (r.loonheffing ?? 0) === (server[i].loonheffing ?? 0) &&
      (r.pensioenpremie ?? 0) === (server[i].pensioenpremie ?? 0)
  );
}