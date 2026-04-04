"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";

type Taak = {
  id: number;
  routine_id: number;
  naam: string;
  kleurcode: "roze" | "groen" | "geel" | null;
  reinigen: boolean;
  desinfecteren: boolean;
  frequentie: "D" | "W" | "2D";
  weekdagen: string[];
  sortering: number;
  actief: boolean;
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(text || "Fout bij laden");
  }

  return text ? JSON.parse(text) : [];
};

const WEEKDAGEN = [
  { value: "ma", label: "ma" },
  { value: "di", label: "di" },
  { value: "wo", label: "wo" },
  { value: "do", label: "do" },
  { value: "vr", label: "vr" },
  { value: "za", label: "za" },
  { value: "zo", label: "zo" },
];

type FormTaak = {
  id: number;
  naam: string;
  kleurcode: "roze" | "groen" | "geel" | "";
  reinigen: boolean;
  desinfecteren: boolean;
  frequentie: "D" | "W" | "2D";
  weekdagen: string[];
  sortering: number;
  actief: boolean;
};

function toFormTaak(t: Taak): FormTaak {
  return {
    id: t.id,
    naam: t.naam,
    kleurcode: t.kleurcode ?? "",
    reinigen: t.reinigen,
    desinfecteren: t.desinfecteren,
    frequentie: t.frequentie,
    weekdagen: t.weekdagen ?? [],
    sortering: t.sortering,
    actief: t.actief,
  };
}

export default function AdminRoutineEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [routineId, setRoutineId] = useState<string>("");

  useMemo(() => {
    params.then((v) => setRoutineId(v.id));
  }, [params]);

  const { data, mutate, isLoading } = useSWR<Taak[]>(
    routineId ? `/api/admin/routines/${routineId}/taken` : null,
    fetcher
  );

  const [savingId, setSavingId] = useState<number | "new" | null>(null);
  const [message, setMessage] = useState("");

  const [nieuw, setNieuw] = useState<Omit<FormTaak, "id">>({
    naam: "",
    kleurcode: "",
    reinigen: false,
    desinfecteren: false,
    frequentie: "D",
    weekdagen: [],
    sortering: 0,
    actief: true,
  });

  const taken = useMemo(() => (data || []).map(toFormTaak), [data]);

  async function saveTaak(taak: FormTaak) {
    try {
      setSavingId(taak.id);
      setMessage("");

      const res = await fetch(`/api/admin/routines/${routineId}/taken`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...taak,
          kleurcode: taak.kleurcode || null,
        }),
      });

const text = await res.text();
const json = text ? JSON.parse(text) : null;

if (!res.ok) throw new Error(json?.error || text || "Opslaan mislukt");

      await mutate();
      setMessage("Taak opgeslagen.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setSavingId(null);
    }
  }

  async function addTaak() {
    try {
      setSavingId("new");
      setMessage("");

      const res = await fetch(`/api/admin/routines/${routineId}/taken`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...nieuw,
          kleurcode: nieuw.kleurcode || null,
        }),
      });

const text = await res.text();
const json = text ? JSON.parse(text) : null;

if (!res.ok) throw new Error(json?.error || text || "Toevoegen mislukt");

      await mutate();
      setNieuw({
        naam: "",
        kleurcode: "",
        reinigen: false,
        desinfecteren: false,
        frequentie: "D",
        weekdagen: [],
        sortering: 0,
        actief: true,
      });
      setMessage("Taak toegevoegd.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Toevoegen mislukt");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteTaak(id: number) {
    const ok = window.confirm("Weet je zeker dat je deze taak wilt verwijderen?");
    if (!ok) return;

    try {
      setSavingId(id);
      setMessage("");

      const res = await fetch(`/api/admin/routines/${routineId}/taken`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

const text = await res.text();
const json = text ? JSON.parse(text) : null;

if (!res.ok) throw new Error(json?.error || text || "Verwijderen mislukt");

      await mutate();
      setMessage("Taak verwijderd.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Verwijderen mislukt");
    } finally {
      setSavingId(null);
    }
  }

  async function moveTaak(index: number, direction: -1 | 1) {
    if (!data) return;

    const reordered = [...data];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= reordered.length) return;

    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];

    const items = reordered.map((item, i) => ({
      id: item.id,
      sortering: (i + 1) * 10,
    }));

    try {
      setMessage("");

      const res = await fetch(`/api/admin/routines/${routineId}/taken/sortering`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

const text = await res.text();
const json = text ? JSON.parse(text) : null;

if (!res.ok) throw new Error(json?.error || text || "Sortering opslaan mislukt");

      await mutate();
      setMessage("Volgorde opgeslagen.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Sortering opslaan mislukt");
    }
  }

  function toggleWeekdag(
    current: string[],
    dag: string,
    setter: (next: string[]) => void
  ) {
    if (current.includes(dag)) {
      setter(current.filter((d) => d !== dag));
    } else {
      setter([...current, dag]);
    }
  }

  if (isLoading) {
    return <div className="p-6">Taken laden...</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500">Admin</p>
            <h1 className="text-3xl font-bold text-slate-900">Routine bewerken</h1>
          </div>

          <Link
            href={`/admin/routines/${routineId}`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            Terug
          </Link>
        </div>

        {message ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Nieuwe taak</h2>

          <div className="grid gap-3 md:grid-cols-12">
            <div className="md:col-span-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">Naam</label>
              <input
                value={nieuw.naam}
                onChange={(e) => setNieuw((s) => ({ ...s, naam: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Kleurcode</label>
              <select
                value={nieuw.kleurcode}
                onChange={(e) =>
                  setNieuw((s) => ({ ...s, kleurcode: e.target.value as FormTaak["kleurcode"] }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="">Geen</option>
                <option value="roze">Roze</option>
                <option value="groen">Groen</option>
                <option value="geel">Geel</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Frequentie</label>
              <select
                value={nieuw.frequentie}
                onChange={(e) =>
                  setNieuw((s) => ({ ...s, frequentie: e.target.value as FormTaak["frequentie"] }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="D">D</option>
                <option value="W">W</option>
                <option value="2D">2D</option>
              </select>
            </div>

            <div className="md:col-span-2 flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={nieuw.reinigen}
                  onChange={(e) => setNieuw((s) => ({ ...s, reinigen: e.target.checked }))}
                />
                Reinigen
              </label>
            </div>

            <div className="md:col-span-2 flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={nieuw.desinfecteren}
                  onChange={(e) => setNieuw((s) => ({ ...s, desinfecteren: e.target.checked }))}
                />
                Desinfecteren
              </label>
            </div>

            <div className="md:col-span-10">
              <label className="mb-1 block text-sm font-medium text-slate-700">Weekdagen</label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAGEN.map((dag) => (
                  <button
                    key={dag.value}
                    type="button"
                    onClick={() =>
                      toggleWeekdag(nieuw.weekdagen, dag.value, (next) =>
                        setNieuw((s) => ({ ...s, weekdagen: next }))
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-sm ${
                      nieuw.weekdagen.includes(dag.value)
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {dag.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 flex items-end">
              <button
                type="button"
                onClick={addTaak}
                disabled={savingId === "new"}
                className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {savingId === "new" ? "Opslaan..." : "Toevoegen"}
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          {taken.map((taak, index) => (
            <TaakRow
              key={taak.id}
              taak={taak}
              index={index}
              isSaving={savingId === taak.id}
              onSave={saveTaak}
              onDelete={deleteTaak}
              onMove={moveTaak}
            />
          ))}
        </section>
      </div>
    </main>
  );
}

function TaakRow({
  taak,
  index,
  isSaving,
  onSave,
  onDelete,
  onMove,
}: {
  taak: FormTaak;
  index: number;
  isSaving: boolean;
  onSave: (taak: FormTaak) => void;
  onDelete: (id: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  const [state, setState] = useState<FormTaak>(taak);

  function toggleDag(dag: string) {
    setState((s) => ({
      ...s,
      weekdagen: s.weekdagen.includes(dag)
        ? s.weekdagen.filter((d) => d !== dag)
        : [...s.weekdagen, dag],
    }));
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-slate-500">Taak #{state.id}</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onMove(index, -1)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            Omhoog
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 1)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            Omlaag
          </button>
          <button
            type="button"
            onClick={() => onDelete(state.id)}
            className="rounded-xl border border-red-300 bg-white px-3 py-2 text-sm text-red-700"
          >
            Verwijderen
          </button>
          <button
            type="button"
            onClick={() => onSave(state)}
            disabled={isSaving}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSaving ? "Opslaan..." : "Opslaan"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-12">
        <div className="md:col-span-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">Naam</label>
          <input
            value={state.naam}
            onChange={(e) => setState((s) => ({ ...s, naam: e.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Kleurcode</label>
          <select
            value={state.kleurcode}
            onChange={(e) =>
              setState((s) => ({ ...s, kleurcode: e.target.value as FormTaak["kleurcode"] }))
            }
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
          >
            <option value="">Geen</option>
            <option value="roze">Roze</option>
            <option value="groen">Groen</option>
            <option value="geel">Geel</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Frequentie</label>
          <select
            value={state.frequentie}
            onChange={(e) =>
              setState((s) => ({ ...s, frequentie: e.target.value as FormTaak["frequentie"] }))
            }
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
          >
            <option value="D">D</option>
            <option value="W">W</option>
            <option value="2D">2D</option>
          </select>
        </div>

        <div className="md:col-span-2 flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.reinigen}
              onChange={(e) => setState((s) => ({ ...s, reinigen: e.target.checked }))}
            />
            Reinigen
          </label>
        </div>

        <div className="md:col-span-2 flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.desinfecteren}
              onChange={(e) => setState((s) => ({ ...s, desinfecteren: e.target.checked }))}
            />
            Desinfecteren
          </label>
        </div>

        <div className="md:col-span-10">
          <label className="mb-1 block text-sm font-medium text-slate-700">Weekdagen</label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAGEN.map((dag) => (
              <button
                key={dag.value}
                type="button"
                onClick={() => toggleDag(dag.value)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  state.weekdagen.includes(dag.value)
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                {dag.label}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Actief</label>
          <select
            value={state.actief ? "ja" : "nee"}
            onChange={(e) => setState((s) => ({ ...s, actief: e.target.value === "ja" }))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
          >
            <option value="ja">Ja</option>
            <option value="nee">Nee</option>
          </select>
        </div>
      </div>
    </div>
  );
}