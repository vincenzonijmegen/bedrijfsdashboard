"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

export const dynamic = "force-dynamic";

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

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  if (!res.ok) throw new Error(text || "Fout bij laden");

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

function kleurBadge(kleurcode: FormTaak["kleurcode"]) {
  if (kleurcode === "roze") {
    return "bg-pink-100 text-pink-700 border-pink-200";
  }

  if (kleurcode === "groen") {
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }

  if (kleurcode === "geel") {
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  }

  return "bg-slate-100 text-slate-600 border-slate-200";
}

export default function AdminRoutineEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [routineId, setRoutineId] = useState("");

  useEffect(() => {
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

    [reordered[index], reordered[newIndex]] = [
      reordered[newIndex],
      reordered[index],
    ];

    const items = reordered.map((item, i) => ({
      id: item.id,
      sortering: (i + 1) * 10,
    }));

    try {
      setMessage("");

      const res = await fetch(
        `/api/admin/routines/${routineId}/taken/sortering`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        }
      );

      const text = await res.text();
      const json = text ? JSON.parse(text) : null;

      if (!res.ok) {
        throw new Error(json?.error || text || "Sortering opslaan mislukt");
      }

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
    setter(
      current.includes(dag)
        ? current.filter((d) => d !== dag)
        : [...current, dag]
    );
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 md:p-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Taken laden...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Admin · Routines
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                Routine bewerken
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Beheer taken, frequenties, weekdagen en HACCP-kleurcodes.
              </p>
            </div>

            <Link
              href="/admin/routines"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Terug naar routines
            </Link>
          </div>
        </section>

        {message ? (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            {message}
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Nieuwe taak</h2>
              <p className="text-sm text-slate-500">
                Voeg een nieuwe routine-taak toe aan deze lijst.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-12">
            <div className="md:col-span-4">
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Naam
              </label>
              <input
                value={nieuw.naam}
                onChange={(e) =>
                  setNieuw((s) => ({ ...s, naam: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Kleurcode
              </label>
              <select
                value={nieuw.kleurcode}
                onChange={(e) =>
                  setNieuw((s) => ({
                    ...s,
                    kleurcode: e.target.value as FormTaak["kleurcode"],
                  }))
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Geen</option>
                <option value="roze">Roze</option>
                <option value="groen">Groen</option>
                <option value="geel">Geel</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Frequentie
              </label>
              <select
                value={nieuw.frequentie}
                onChange={(e) =>
                  setNieuw((s) => ({
                    ...s,
                    frequentie: e.target.value as FormTaak["frequentie"],
                  }))
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="D">Dagelijks</option>
                <option value="W">Wekelijks</option>
                <option value="2D">Om de 2 dagen</option>
              </select>
            </div>

            <label className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 md:col-span-2">
              <input
                type="checkbox"
                checked={nieuw.reinigen}
                onChange={(e) =>
                  setNieuw((s) => ({ ...s, reinigen: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              Reinigen
            </label>

            <label className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 md:col-span-2">
              <input
                type="checkbox"
                checked={nieuw.desinfecteren}
                onChange={(e) =>
                  setNieuw((s) => ({ ...s, desinfecteren: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              Desinfecteren
            </label>

            <div className="md:col-span-10">
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Weekdagen
              </label>

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
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                      nieuw.weekdagen.includes(dag.value)
                        ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {dag.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 md:flex md:items-end">
              <button
                type="button"
                onClick={addTaak}
                disabled={savingId === "new" || !nieuw.naam.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
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

          {taken.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
              Nog geen taken gevonden voor deze routine.
            </div>
          ) : null}
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Taak #{state.id}
          </span>

          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${kleurBadge(
              state.kleurcode
            )}`}
          >
            {state.kleurcode || "geen kleur"}
          </span>

          {state.actief ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Actief
            </span>
          ) : (
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
              Inactief
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onMove(index, -1)}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowUp className="h-4 w-4" />
            Omhoog
          </button>

          <button
            type="button"
            onClick={() => onMove(index, 1)}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowDown className="h-4 w-4" />
            Omlaag
          </button>

          <button
            type="button"
            onClick={() => onDelete(state.id)}
            className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
          >
            <Trash2 className="h-4 w-4" />
            Verwijderen
          </button>

          <button
            type="button"
            onClick={() => onSave(state)}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Opslaan..." : "Opslaan"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-12">
        <div className="md:col-span-4">
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Naam
          </label>
          <input
            value={state.naam}
            onChange={(e) => setState((s) => ({ ...s, naam: e.target.value }))}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Kleurcode
          </label>
          <select
            value={state.kleurcode}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                kleurcode: e.target.value as FormTaak["kleurcode"],
              }))
            }
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Geen</option>
            <option value="roze">Roze</option>
            <option value="groen">Groen</option>
            <option value="geel">Geel</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Frequentie
          </label>
          <select
            value={state.frequentie}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                frequentie: e.target.value as FormTaak["frequentie"],
              }))
            }
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="D">Dagelijks</option>
            <option value="W">Wekelijks</option>
            <option value="2D">Om de 2 dagen</option>
          </select>
        </div>

        <label className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 md:col-span-2">
          <input
            type="checkbox"
            checked={state.reinigen}
            onChange={(e) =>
              setState((s) => ({ ...s, reinigen: e.target.checked }))
            }
            className="h-4 w-4 rounded border-slate-300"
          />
          Reinigen
        </label>

        <label className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 md:col-span-2">
          <input
            type="checkbox"
            checked={state.desinfecteren}
            onChange={(e) =>
              setState((s) => ({ ...s, desinfecteren: e.target.checked }))
            }
            className="h-4 w-4 rounded border-slate-300"
          />
          Desinfecteren
        </label>

        <div className="md:col-span-10">
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Weekdagen
          </label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAGEN.map((dag) => (
              <button
                key={dag.value}
                type="button"
                onClick={() => toggleDag(dag.value)}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                  state.weekdagen.includes(dag.value)
                    ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {dag.label}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Actief
          </label>
          <select
            value={state.actief ? "ja" : "nee"}
            onChange={(e) =>
              setState((s) => ({ ...s, actief: e.target.value === "ja" }))
            }
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="ja">Ja</option>
            <option value="nee">Nee</option>
          </select>
        </div>
      </div>
    </div>
  );
}