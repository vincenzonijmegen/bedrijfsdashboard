"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Pencil, CheckCircle2, GripVertical } from "lucide-react";

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

  const containerClass = isWeeklyDone
    ? "flex items-center justify-between border border-emerald-200 bg-emerald-50 text-emerald-900 px-3 py-2 rounded-md transition"
    : isAfgehandeld
    ? "flex items-center justify-between border border-gray-200 bg-white text-gray-500 px-3 py-2 rounded-md transition"
    : "flex items-center justify-between border border-gray-200 bg-white px-3 py-2 rounded-md shadow-sm hover:bg-gray-50 transition";

  return (
    <div className={containerClass}>
      <div className="flex items-start gap-3 flex-1 select-none">
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
            className="mt-1 h-4 w-4 accent-blue-600"
          />
        )}

        <div className="min-w-0">
          <div
            className={`prose max-w-none text-[15px] leading-relaxed ${
              isAfgehandeld ? "line-through" : ""
            }`}
            dangerouslySetInnerHTML={{ __html: actie.tekst || "" }}
          />

          {isAfgehandeld && actie.afgehandeld_op && (
            <div className="mt-1 text-xs text-gray-500 no-underline">
              Afgehandeld op {formatDatumTijd(actie.afgehandeld_op)}
            </div>
          )}
        </div>
      </div>

      <div className="ml-3 flex items-center gap-2 shrink-0">
        {actie.is_weekly && !isAfgehandeld && !actie.done_this_week && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onWeeklyDone(actie.id)}
            className="px-3 py-1 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700 transition"
            title="Markeer als klaar voor deze week"
          >
            Klaar voor deze week
          </button>
        )}

        {actie.is_weekly && actie.done_this_week && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-medium">
              <CheckCircle2 className="w-3 h-3" />
              Deze week gedaan
            </span>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onWeeklyUndo(actie.id)}
              className="text-xs text-emerald-700 underline hover:text-emerald-800"
              title="Zet terug naar open acties"
            >
              Toch terugzetten
            </button>
          </div>
        )}

        {rightExtras}

        <button
          type="button"
          title="Bewerken"
          className="p-1 rounded text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition opacity-70 hover:opacity-100"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() =>
            onEdit({
              id: actie.id,
              tekst: actie.tekst || "<p></p>",
              is_weekly: !!actie.is_weekly,
            })
          }
        >
          <Pencil size={18} />
        </button>
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
    background: "transparent",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <RowInner
        {...props}
        rightExtras={
          <button
            aria-label="Sleep om te sorteren"
            title="Sleep om te sorteren"
            className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-grab active:cursor-grabbing transition opacity-60 hover:opacity-100"
            onPointerDown={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={18} />
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

  const isEmptyLists = !lijsten || lijsten.length === 0;

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 min-h-screen">
      <div className="col-span-1 space-y-2">
        <h2 className="text-lg font-semibold text-slate-800">Actielijst</h2>

        {lijstLoading && <div className="text-gray-600">Bezig met laden...</div>}
        {lijstError && (
          <div className="text-red-600">Fout bij laden actielijsten.</div>
        )}
        {!lijstLoading && !lijstError && isEmptyLists && (
          <div className="text-gray-600">Geen actielijsten gevonden.</div>
        )}

        {!lijstLoading && !lijstError && !isEmptyLists && (
          <>
            <div className="space-y-2">
              {lijsten!
                .slice()
                .sort((a, b) => a.naam.localeCompare(b.naam))
                .map((lijst) => (
                  <div key={lijst.id} className="flex items-center gap-2">
                    <button
                      className={`flex-1 flex items-center gap-2 px-4 py-2 border rounded-md text-left transition ${
                        lijst.id === geselecteerdeLijst?.id
                          ? "bg-blue-50 border-blue-200 text-blue-950 font-semibold shadow-sm"
                          : "bg-white hover:bg-gray-50 border-gray-200"
                      }`}
                      onClick={() => setGeselecteerdeLijst(lijst)}
                    >
                      <span>{lijst.icoon}</span> {lijst.naam}
                    </button>

                    <button
                      onClick={() => setLijstEdit({ ...lijst })}
                      className="text-sm text-blue-500 opacity-70 hover:opacity-100 transition"
                    >
                      ✏️
                    </button>

                    <button
                      onClick={() => lijstVerwijderen(lijst.id)}
                      className="text-sm text-red-400 opacity-70 hover:opacity-100 transition"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
            </div>

            <div className="pt-4 space-y-2">
              <input
                className="w-full border border-gray-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={nieuweLijstNaam}
                onChange={(e) => setNieuweLijstNaam(e.target.value)}
                placeholder="Nieuwe lijstnaam"
              />
              <button
                onClick={nieuweLijstToevoegen}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md transition"
              >
                + Nieuwe lijst
              </button>
            </div>

            {lijstEdit && (
              <div className="pt-4 space-y-2 border-t mt-4">
                <h3 className="text-sm font-semibold">Bewerk lijst</h3>

                <input
                  className="w-full border border-gray-200 rounded-md px-3 py-2 bg-white"
                  value={lijstEdit.naam}
                  onChange={(e) =>
                    setLijstEdit({ ...lijstEdit, naam: e.target.value })
                  }
                />

                <input
                  className="w-full border border-gray-200 rounded-md px-3 py-2 bg-white"
                  value={lijstEdit.icoon}
                  onChange={(e) =>
                    setLijstEdit({ ...lijstEdit, icoon: e.target.value })
                  }
                />

                <button
                  onClick={lijstBijwerken}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-md transition"
                >
                  Opslaan
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="col-span-2">
        <h2 className="text-lg font-semibold mb-4 text-slate-900">
          {geselecteerdeLijst?.naam ?? "—"}
        </h2>

        <div className="space-y-1.5">
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
                  ids: nieuweVolgorde.map((id, i) => ({ id, volgorde: i })),
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
        </div>

        <div className="mt-4 border border-gray-200 rounded-md bg-white overflow-hidden">
          <div className="flex items-center gap-2 bg-gray-100 border-b border-gray-200 px-3 py-2">
            <span className="text-sm text-gray-600">Nieuwe actie</span>

            <label className="flex items-center gap-2 text-sm ml-auto">
              <input
                type="checkbox"
                checked={nieuweActieWeekly}
                onChange={(e) => setNieuweActieWeekly(e.target.checked)}
              />
              Wekelijks
            </label>

            <button
              onClick={nieuweActieToevoegen}
              className="ml-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md transition"
            >
              Toevoegen
            </button>
          </div>

          <NotitieEditor
            value={nieuweActieHtml}
            onChange={setNieuweActieHtml}
            editable
            placeholder="Beschrijf de actie…"
          />
        </div>

        {actieEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-3xl">
              <h3 className="text-lg font-semibold mb-3">Bewerk actie</h3>

              <div className="mb-3 border rounded-md overflow-hidden">
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

              <label className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  checked={actieEdit.is_weekly}
                  onChange={(e) =>
                    setActieEdit({
                      ...actieEdit,
                      is_weekly: e.target.checked,
                    })
                  }
                />
                Wekelijks
              </label>

              <div className="flex justify-between items-center gap-2">
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
                  className="text-red-600 mr-auto"
                >
                  🗑️ Verwijderen
                </button>

                <button
                  type="button"
                  onClick={() => setActieEdit(null)}
                  className="text-gray-600"
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
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded-md transition"
                >
                  Opslaan
                </button>
              </div>
            </div>
          </div>
        )}

        {weeklyDoneThisWeek.length > 0 && (
          <details className="mt-8">
            <summary className="cursor-pointer text-sm font-semibold text-emerald-700">
              Deze week gedaan ({weeklyDoneThisWeek.length})
            </summary>

            <div className="mt-2 space-y-1.5">
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
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">
              Afgehandeld
            </h3>

            <div className="space-y-1.5">
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
          </div>
        )}
      </div>
    </div>
  );
}