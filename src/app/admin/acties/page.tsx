"use client";

import React, { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import dynamic from "next/dynamic";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CheckCircle2,
  ClipboardList,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const NotitieEditor = dynamic(() => import("@/components/NotitieEditor"), {
  ssr: false,
});

interface Actie {
  id: number;
  tekst: string;
  voltooid: boolean;
  deadline?: string;
  verantwoordelijke?: string;
  volgorde: number;
  afgehandeld_op?: string | null;
  is_weekly?: boolean;
  done_this_week?: boolean;
}

interface ActieLijst {
  id: number;
  naam: string;
  icoon: string;
}

type EditState = { id: number; tekst: string; is_weekly: boolean };

const isHtmlEmpty = (html: string) =>
  !html || !html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

const formatDatumTijd = (value?: string | null) => {
  if (!value) return "";
  return new Date(value).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

type RowCommonProps = {
  actie: Actie;
  isAfgehandeld?: boolean;
  onToggleCheck: (id: number, voltooid: boolean) => void;
  onEdit: (state: EditState) => void;
  onWeeklyDone: (id: number) => void;
  onWeeklyUndo: (id: number) => void;
  rightExtras?: React.ReactNode;
};

function RowInner({
  actie,
  isAfgehandeld,
  onToggleCheck,
  onEdit,
  onWeeklyDone,
  onWeeklyUndo,
  rightExtras,
}: RowCommonProps) {
  const isWeeklyDone = !!(actie.is_weekly && actie.done_this_week);

  const cardClass = isWeeklyDone
    ? "border-emerald-200 bg-emerald-50"
    : isAfgehandeld
    ? "border-slate-200 bg-white opacity-75"
    : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-md";

  return (
    <div
      className={`group rounded-xl border px-4 py-3 shadow-sm transition ${cardClass}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {!actie.is_weekly && (
            <input
              type="checkbox"
              checked={actie.voltooid}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                onToggleCheck(actie.id, actie.voltooid);
              }}
              className="mt-1 h-5 w-5 rounded border-slate-300 accent-blue-600"
            />
          )}

          {actie.is_weekly && (
            <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50">
              {isWeeklyDone && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div
              className={`prose max-w-none text-[15px] leading-relaxed text-slate-800 ${
                isAfgehandeld ? "line-through text-slate-500" : ""
              }`}
              dangerouslySetInnerHTML={{ __html: actie.tekst || "" }}
            />

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {actie.is_weekly && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                  Wekelijks
                </span>
              )}

              {isAfgehandeld && actie.afgehandeld_op && (
                <span className="text-xs text-slate-500">
                  Afgehandeld op {formatDatumTijd(actie.afgehandeld_op)}
                </span>
              )}

              {isWeeklyDone && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                  <CheckCircle2 className="h-3 w-3" />
                  Deze week gedaan
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {actie.is_weekly && !isAfgehandeld && !actie.done_this_week && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onWeeklyDone(actie.id)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
            >
              Klaar
            </button>
          )}

          {actie.is_weekly && actie.done_this_week && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onWeeklyUndo(actie.id)}
              className="text-xs font-medium text-emerald-700 underline hover:text-emerald-900"
            >
              Terugzetten
            </button>
          )}

          {rightExtras}

          <button
            type="button"
            title="Bewerken"
            className="rounded-lg p-2 text-slate-400 opacity-70 transition hover:bg-blue-50 hover:text-blue-600 group-hover:opacity-100"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() =>
              onEdit({
                id: actie.id,
                tekst: actie.tekst || "<p></p>",
                is_weekly: !!actie.is_weekly,
              })
            }
          >
            <Pencil size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

type SortableRowProps = RowCommonProps & { id: number };

function SortableActieRow(props: SortableRowProps) {
  const { id } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <RowInner
        {...props}
        rightExtras={
          <button
            aria-label="Sleep om te sorteren"
            title="Sleep om te sorteren"
            className="cursor-grab rounded-lg p-2 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
            onPointerDown={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={17} />
          </button>
        }
      />
    </div>
  );
}

function StaticActieRow(props: RowCommonProps) {
  return <RowInner {...props} />;
}

export default function ActieLijstPagina() {
  const {
    data: lijsten,
    error: lijstError,
    isLoading: lijstLoading,
    mutate: mutateLijsten,
  } = useSWR<ActieLijst[]>("/api/actielijsten", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const [geselecteerdeLijst, setGeselecteerdeLijst] =
    useState<ActieLijst | null>(null);

  const { data: actiesRaw = [], mutate } = useSWR<Actie[]>(
    geselecteerdeLijst ? `/api/acties?lijst_id=${geselecteerdeLijst.id}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30000,
    }
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const [dndVolgorde, setDndVolgorde] = useState<number[]>([]);
  const [nieuweLijstNaam, setNieuweLijstNaam] = useState("");
  const [nieuweActieHtml, setNieuweActieHtml] = useState<string>("");
  const [nieuweActieWeekly, setNieuweActieWeekly] = useState(false);
  const [lijstEdit, setLijstEdit] =
    useState<{ id: number; naam: string; icoon: string } | null>(null);
  const [actieEdit, setActieEdit] = useState<EditState | null>(null);

  useEffect(() => {
    if (lijsten && lijsten.length > 0 && !geselecteerdeLijst) {
      setGeselecteerdeLijst(lijsten[0]);
    }
  }, [lijsten, geselecteerdeLijst]);

  useEffect(() => {
    const openActies = actiesRaw
      .filter((a) => !a.voltooid && !(a.is_weekly && a.done_this_week))
      .sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0));

    setDndVolgorde(openActies.map((a) => a.id));
  }, [actiesRaw]);

  const openActiesSorted = useMemo(() => {
    const open = actiesRaw.filter(
      (a) => !a.voltooid && !(a.is_weekly && a.done_this_week)
    );

    return open.sort(
      (a, b) => dndVolgorde.indexOf(a.id) - dndVolgorde.indexOf(b.id)
    );
  }, [actiesRaw, dndVolgorde]);

  const weeklyDoneThisWeek = useMemo(
    () =>
      actiesRaw
        .filter((a) => a.is_weekly && a.done_this_week)
        .sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0)),
    [actiesRaw]
  );

  const afgehandeldSorted = useMemo(
    () =>
      actiesRaw
        .filter((a) => a.voltooid)
        .sort((a, b) => {
          const aDate = a.afgehandeld_op
            ? new Date(a.afgehandeld_op).getTime()
            : 0;
          const bDate = b.afgehandeld_op
            ? new Date(b.afgehandeld_op).getTime()
            : 0;
          return bDate - aDate;
        }),
    [actiesRaw]
  );

  const gesorteerdeLijsten = useMemo(
    () => (lijsten || []).slice().sort((a, b) => a.naam.localeCompare(b.naam)),
    [lijsten]
  );

  const openCount = openActiesSorted.length;
  const doneCount = afgehandeldSorted.length + weeklyDoneThisWeek.length;
  const isEmptyLists = !lijsten || lijsten.length === 0;

  const toggleActie = async (id: number, voltooid: boolean) => {
    mutate(
      (huidig) =>
        (huidig || []).map((a: Actie) =>
          a.id === id
            ? {
                ...a,
                voltooid: !voltooid,
                afgehandeld_op: !voltooid ? new Date().toISOString() : null,
              }
            : a
        ),
      { revalidate: false }
    );

    try {
      await fetch("/api/acties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, voltooid: !voltooid }),
      });
    } finally {
      mutate();
    }
  };

  const markWeeklyDone = async (id: number) => {
    await fetch("/api/acties/wekelijks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "done" }),
    });
    mutate();
  };

  const undoWeeklyDone = async (id: number) => {
    await fetch("/api/acties/wekelijks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "undone" }),
    });
    mutate();
  };

  const updateActie = async (
    id: number,
    tekstHtml: string,
    is_weekly: boolean
  ) => {
    await fetch("/api/acties", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        tekst: tekstHtml,
        recurring: is_weekly ? "weekly" : "none",
      }),
    });
    mutate();
  };

  const nieuweLijstToevoegen = async () => {
    if (!nieuweLijstNaam.trim()) return;

    await fetch("/api/actielijsten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ naam: nieuweLijstNaam.trim(), icoon: "📋" }),
    });

    setNieuweLijstNaam("");
    mutateLijsten();
  };

  const lijstVerwijderen = async (id: number) => {
    if (!confirm("Weet je zeker dat je deze lijst wilt verwijderen?")) return;

    await fetch("/api/actielijsten", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    mutateLijsten();
    if (geselecteerdeLijst?.id === id) setGeselecteerdeLijst(null);
  };

  const lijstBijwerken = async () => {
    if (!lijstEdit) return;

    await fetch("/api/actielijsten", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lijstEdit),
    });

    setLijstEdit(null);
    mutateLijsten();
  };

  const nieuweActieToevoegen = async () => {
    if (!geselecteerdeLijst) return;
    if (isHtmlEmpty(nieuweActieHtml)) return;

    await fetch("/api/acties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lijst_id: geselecteerdeLijst.id,
        tekst: nieuweActieHtml,
        recurring: nieuweActieWeekly ? "weekly" : "none",
      }),
    });

    setNieuweActieHtml("");
    setNieuweActieWeekly(false);
    mutate();
  };

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
                <ClipboardList className="h-4 w-4" />
                Management / Actielijsten
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Actielijsten
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Overzicht van open acties, wekelijkse taken en afgeronde punten.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
                <div className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Open
                </div>
                <div className="text-2xl font-bold text-blue-950">{openCount}</div>
              </div>
              <div className="rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                <div className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                  Gedaan
                </div>
                <div className="text-2xl font-bold text-emerald-950">
                  {doneCount}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Actielijsten
              </h2>

              {lijstLoading && (
                <div className="text-sm text-slate-500">Bezig met laden...</div>
              )}

              {lijstError && (
                <div className="text-sm text-red-600">
                  Fout bij laden actielijsten.
                </div>
              )}

              {!lijstLoading && !lijstError && isEmptyLists && (
                <div className="text-sm text-slate-500">
                  Geen actielijsten gevonden.
                </div>
              )}

              <div className="space-y-2">
                {gesorteerdeLijsten.map((lijst) => {
                  const actief = lijst.id === geselecteerdeLijst?.id;

                  return (
                    <div key={lijst.id} className="flex items-center gap-2">
                      <button
                        className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                          actief
                            ? "bg-blue-600 font-semibold text-white shadow-sm"
                            : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                        }`}
                        onClick={() => setGeselecteerdeLijst(lijst)}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/70 text-base">
                          {lijst.icoon}
                        </span>
                        <span className="truncate">{lijst.naam}</span>
                      </button>

                      <button
                        onClick={() => setLijstEdit({ ...lijst })}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                        title="Lijst bewerken"
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        onClick={() => lijstVerwijderen(lijst.id)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        title="Lijst verwijderen"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">
                Nieuwe lijst
              </h3>

              <div className="space-y-2">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  value={nieuweLijstNaam}
                  onChange={(e) => setNieuweLijstNaam(e.target.value)}
                  placeholder="Bijv. Zomerfeesten"
                />

                <button
                  onClick={nieuweLijstToevoegen}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  <Plus size={16} />
                  Nieuwe lijst
                </button>
              </div>
            </div>

            {lijstEdit && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Lijst bewerken
                  </h3>
                  <button
                    onClick={() => setLijstEdit(null)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-2">
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    value={lijstEdit.naam}
                    onChange={(e) =>
                      setLijstEdit({ ...lijstEdit, naam: e.target.value })
                    }
                  />

                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    value={lijstEdit.icoon}
                    onChange={(e) =>
                      setLijstEdit({ ...lijstEdit, icoon: e.target.value })
                    }
                  />

                  <button
                    onClick={lijstBijwerken}
                    className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    Opslaan
                  </button>
                </div>
              </div>
            )}
          </aside>

          <main className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">
                    {geselecteerdeLijst?.naam ?? "Geen lijst geselecteerd"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {openCount} open acties
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={async ({ active, over }) => {
                    if (!over || active.id === over.id) return;

                    const oudeIndex = dndVolgorde.indexOf(active.id as number);
                    const nieuweIndex = dndVolgorde.indexOf(over.id as number);

                    if (oudeIndex === -1 || nieuweIndex === -1) return;

                    const nieuweVolgorde = arrayMove(
                      dndVolgorde,
                      oudeIndex,
                      nieuweIndex
                    );

                    setDndVolgorde(nieuweVolgorde);

                    await fetch("/api/acties/volgorde", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        ids: nieuweVolgorde.map((id, i) => ({
                          id,
                          volgorde: i,
                        })),
                      }),
                    });

                    mutate();
                  }}
                >
                  <SortableContext
                    items={dndVolgorde}
                    strategy={verticalListSortingStrategy}
                  >
                    {openActiesSorted.map((actie) => (
                      <SortableActieRow
                        key={actie.id}
                        id={actie.id}
                        actie={actie}
                        isAfgehandeld={false}
                        onToggleCheck={toggleActie}
                        onEdit={(s) => setActieEdit(s)}
                        onWeeklyDone={markWeeklyDone}
                        onWeeklyUndo={undoWeeklyDone}
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                {openActiesSorted.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    Geen open acties in deze lijst.
                  </div>
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Nieuwe actie
                  </h3>
                  <p className="text-xs text-slate-500">
                    Voeg direct een actie toe aan deze lijst.
                  </p>
                </div>

                <label className="ml-auto flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={nieuweActieWeekly}
                    onChange={(e) => setNieuweActieWeekly(e.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  Wekelijks
                </label>

                <button
                  onClick={nieuweActieToevoegen}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  <Plus size={16} />
                  Toevoegen
                </button>
              </div>

              <div className="min-h-[150px]">
                <NotitieEditor
                  value={nieuweActieHtml}
                  onChange={setNieuweActieHtml}
                  editable
                  placeholder="Beschrijf de actie…"
                />
              </div>
            </section>

            {weeklyDoneThisWeek.length > 0 && (
              <details className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
                <summary className="cursor-pointer text-sm font-semibold text-emerald-800">
                  Deze week gedaan ({weeklyDoneThisWeek.length})
                </summary>

                <div className="mt-4 space-y-3">
                  {weeklyDoneThisWeek.map((actie) => (
                    <StaticActieRow
                      key={actie.id}
                      actie={actie}
                      isAfgehandeld={true}
                      onToggleCheck={toggleActie}
                      onEdit={(s) => setActieEdit(s)}
                      onWeeklyDone={markWeeklyDone}
                      onWeeklyUndo={undoWeeklyDone}
                    />
                  ))}
                </div>
              </details>
            )}

            {afgehandeldSorted.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Afgehandeld ({afgehandeldSorted.length})
                </h3>

                <div className="space-y-3">
                  {afgehandeldSorted.map((actie) => (
                    <StaticActieRow
                      key={actie.id}
                      actie={actie}
                      isAfgehandeld={true}
                      onToggleCheck={toggleActie}
                      onEdit={(s) => setActieEdit(s)}
                      onWeeklyDone={markWeeklyDone}
                      onWeeklyUndo={undoWeeklyDone}
                    />
                  ))}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>

      {actieEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-950">Actie bewerken</h3>
              <button
                type="button"
                onClick={() => setActieEdit(null)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4 overflow-hidden rounded-xl border border-slate-200">
                <NotitieEditor
                  value={actieEdit.tekst}
                  onChange={(html) =>
                    setActieEdit((prev) =>
                      prev ? { ...prev, tekst: html } : prev
                    )
                  }
                  editable
                  placeholder="Wijzig de actie…"
                />
              </div>

              <label className="mb-6 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={actieEdit.is_weekly}
                  onChange={(e) =>
                    setActieEdit({
                      ...actieEdit,
                      is_weekly: e.target.checked,
                    })
                  }
                  className="h-4 w-4 accent-blue-600"
                />
                Wekelijks terugkerende actie
              </label>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      confirm("Weet je zeker dat je deze actie wilt verwijderen?")
                    ) {
                      await fetch("/api/acties", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: actieEdit.id }),
                      });

                      setActieEdit(null);
                      mutate();
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 size={16} />
                  Verwijderen
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActieEdit(null)}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    Annuleren
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (!actieEdit) return;
                      if (isHtmlEmpty(actieEdit.tekst)) return;

                      await updateActie(
                        actieEdit.id,
                        actieEdit.tekst,
                        actieEdit.is_weekly
                      );

                      setActieEdit(null);
                    }}
                    className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    Opslaan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}