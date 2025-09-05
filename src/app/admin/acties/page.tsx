"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
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

interface Actie {
  id: number;
  tekst: string;
  voltooid: boolean;
  deadline?: string;
  verantwoordelijke?: string;
  volgorde: number;
  // afgeleid in GET /api/acties
  is_weekly?: boolean;       // recurring == 'weekly'
  done_this_week?: boolean;  // deze ISO-week afgehandeld
}

interface ActieLijst {
  id: number;
  naam: string;
  icoon: string;
}

type EditState = { id: number; tekst: string; is_weekly: boolean };

/* ----------------------------- ROW: SHARED UI ----------------------------- */

type RowCommonProps = {
  actie: Actie;
  isAfgehandeld?: boolean;
  onToggleCheck: (id: number, voltooid: boolean) => void;
  onEdit: (state: EditState) => void;
  onWeeklyDone: (id: number) => void;
  onWeeklyUndo: (id: number) => void;
  rightExtras?: React.ReactNode; // plek voor drag-handle etc.
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
    ? "flex items-center justify-between border border-emerald-200 bg-emerald-50 text-emerald-900 p-3 rounded"
    : isAfgehandeld
    ? "flex items-center justify-between border p-3 rounded bg-gray-50 text-gray-500"
    : "flex items-center justify-between border p-3 rounded bg-white shadow-sm";

  return (
    <div className={containerClass}>
      {/* Links: tekst (of checkbox + tekst) */}
      <div className="flex items-center gap-3 flex-1 select-none">
        {!actie.is_weekly ? (
          <>
            <input
              type="checkbox"
              checked={actie.voltooid}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                onToggleCheck(actie.id, actie.voltooid);
              }}
            />
            <span className={isAfgehandeld ? "line-through" : ""}>{actie.tekst}</span>
          </>
        ) : (
          <span className={isAfgehandeld ? "line-through" : ""}>{actie.tekst}</span>
        )}
      </div>

      {/* Rechts: acties / knoppen */}
      <div className="ml-auto flex items-center gap-2">
        {actie.is_weekly && !isAfgehandeld && !actie.done_this_week && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onWeeklyDone(actie.id)}
            className="px-3 py-1 rounded bg-emerald-600 text-white text-sm"
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

        {/* extra controls rechts (bv. drag-handle) */}
        {rightExtras}

        <button
          type="button"
          title="Bewerken"
          className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onEdit({ id: actie.id, tekst: actie.tekst, is_weekly: !!actie.is_weekly })}
        >
          <Pencil size={18} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------- ROW: SORTABLE (OPEN LIJST) ------------------------- */

type SortableRowProps = RowCommonProps & { id: number };

function SortableActieRow(props: SortableRowProps) {
  const { id } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

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
            className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-grab active:cursor-grabbing"
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

/* ----------------------------- ROW: STATIC (OVERIG) ----------------------------- */

function StaticActieRow(props: RowCommonProps) {
  return <RowInner {...props} />;
}

/* ----------------------------------- PAGE ----------------------------------- */

export default function ActieLijstPagina() {
  // Lijsten
  const {
    data: lijsten,
    error: lijstError,
    isLoading: lijstLoading,
    mutate: mutateLijsten,
  } = useSWR<ActieLijst[]>("/api/actielijsten", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const [geselecteerdeLijst, setGeselecteerdeLijst] = useState<ActieLijst | null>(null);

  // Acties
  const { data: actiesRaw = [], mutate } = useSWR<Actie[]>(
    geselecteerdeLijst ? `/api/acties?lijst_id=${geselecteerdeLijst.id}` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30000 }
  );

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }) // pas slepen na 8px
  );
  const [dndVolgorde, setDndVolgorde] = useState<number[]>([]);

  // Form state
  const [nieuweLijstNaam, setNieuweLijstNaam] = useState("");
  const [nieuweActieTekst, setNieuweActieTekst] = useState("");
  const [nieuweActieWeekly, setNieuweActieWeekly] = useState(false);
  const [lijstEdit, setLijstEdit] =
    useState<{ id: number; naam: string; icoon: string } | null>(null);
  const [actieEdit, setActieEdit] = useState<EditState | null>(null);

  // Init: kies eerste lijst
  useEffect(() => {
    if (lijsten && lijsten.length > 0 && !geselecteerdeLijst) {
      setGeselecteerdeLijst(lijsten[0]);
    }
  }, [lijsten, geselecteerdeLijst]);

  // DnD volgorde syncen met server-data (alleen open & niet weekly-done)
  useEffect(() => {
    const openActies = actiesRaw
      .filter((a) => !a.voltooid && !(a.is_weekly && a.done_this_week))
      .sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0));
    setDndVolgorde(openActies.map((a) => a.id));
  }, [actiesRaw]);

  // Handlers
  const toggleActie = async (id: number, voltooid: boolean) => {
    // Optimistisch wisselen
    mutate(
      (huidig) =>
        (huidig || []).map((a: Actie) => (a.id === id ? { ...a, voltooid: !voltooid } : a)),
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

  const updateActie = async (id: number, tekst: string, is_weekly: boolean) => {
    await fetch("/api/acties", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, tekst, recurring: is_weekly ? "weekly" : "none" }),
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
    if (!nieuweActieTekst.trim() || !geselecteerdeLijst) return;
    await fetch("/api/acties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lijst_id: geselecteerdeLijst.id,
        tekst: nieuweActieTekst.trim(),
        recurring: nieuweActieWeekly ? "weekly" : "none",
      }),
    });
    setNieuweActieTekst("");
    setNieuweActieWeekly(false);
    mutate();
  };

  // Afgeleide sets (hooks altijd bovenin)
  const openActiesSorted = useMemo(() => {
    const open = actiesRaw.filter((a) => !a.voltooid && !(a.is_weekly && a.done_this_week));
    return open.sort((a, b) => dndVolgorde.indexOf(a.id) - dndVolgorde.indexOf(b.id));
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
      actiesRaw.filter((a) => a.voltooid).sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0)),
    [actiesRaw]
  );

  const isEmptyLists = !lijsten || lijsten.length === 0;

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Lijstenkolom */}
      <div className="col-span-1 space-y-2">
        <h2 className="text-lg font-semibold">Actielijst</h2>

        {lijstLoading && <div className="text-gray-600">Bezig met laden...</div>}
        {lijstError && <div className="text-red-600">Fout bij laden actielijsten.</div>}
        {!lijstLoading && !lijstError && isEmptyLists && (
          <div className="text-gray-600">Geen actielijsten gevonden.</div>
        )}

        {!lijstLoading && !lijstError && !isEmptyLists && (
          <>
            {lijsten!
              .slice()
              .sort((a, b) => a.naam.localeCompare(b.naam))
              .map((lijst) => (
                <div key={lijst.id} className="flex items-center gap-2">
                  <button
                    className={`flex-1 flex items-center gap-2 px-4 py-2 border rounded ${
                      lijst.id === geselecteerdeLijst?.id ? "bg-gray-100 font-semibold" : "hover:bg-gray-50"
                    }`}
                    onClick={() => setGeselecteerdeLijst(lijst)}
                  >
                    <span>{lijst.icoon}</span> {lijst.naam}
                  </button>
                  <button onClick={() => setLijstEdit({ ...lijst })} className="text-sm text-blue-600">
                    ✏️
                  </button>
                  <button onClick={() => lijstVerwijderen(lijst.id)} className="text-sm text-red-500">
                    🗑️
                  </button>
                </div>
              ))}

            <div className="pt-4 space-y-2">
              <input
                className="w-full border rounded px-2 py-1"
                value={nieuweLijstNaam}
                onChange={(e) => setNieuweLijstNaam(e.target.value)}
                placeholder="Nieuwe lijstnaam"
              />
              <button onClick={nieuweLijstToevoegen} className="w-full bg-blue-500 text-white py-1 rounded">
                + Nieuwe lijst
              </button>
            </div>

            {lijstEdit && (
              <div className="pt-4 space-y-2 border-t mt-4">
                <h3 className="text-sm font-semibold">Bewerk lijst</h3>
                <input
                  className="w-full border rounded px-2 py-1"
                  value={lijstEdit.naam}
                  onChange={(e) => setLijstEdit({ ...lijstEdit, naam: e.target.value })}
                />
                <input
                  className="w-full border rounded px-2 py-1"
                  value={lijstEdit.icoon}
                  onChange={(e) => setLijstEdit({ ...lijstEdit, icoon: e.target.value })}
                />
                <button onClick={lijstBijwerken} className="w-full bg-green-600 text-white py-1 rounded">
                  Opslaan
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Rechterkolom */}
      <div className="col-span-2">
        <h2 className="text-lg font-semibold mb-4">{geselecteerdeLijst?.naam ?? "—"}</h2>

        {/* DRAG & DROP voor OPEN acties */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={async ({ active, over }) => {
            if (!over || active.id === over.id) return;
            const oudeIndex = dndVolgorde.indexOf(active.id as number);
            const nieuweIndex = dndVolgorde.indexOf(over.id as number);
            if (oudeIndex === -1 || nieuweIndex === -1) return;

            const nieuweVolgorde = arrayMove(dndVolgorde, oudeIndex, nieuweIndex);
            setDndVolgorde(nieuweVolgorde);

            await fetch("/api/acties/volgorde", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids: nieuweVolgorde.map((id, i) => ({ id, volgorde: i })) }),
            });
            mutate();
          }}
        >
          <SortableContext items={dndVolgorde} strategy={verticalListSortingStrategy}>
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

        {/* Nieuwe actie */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <input
            className="flex-1 border rounded px-2 py-1"
            placeholder="Nieuwe actie"
            value={nieuweActieTekst}
            onChange={(e) => setNieuweActieTekst(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={nieuweActieWeekly}
              onChange={(e) => setNieuweActieWeekly(e.target.checked)}
            />
            Wekelijks
          </label>
          <button
            onClick={nieuweActieToevoegen}
            className="bg-blue-500 px-3 py-1 rounded text-xl font-bold text-white"
          >
            +
          </button>
        </div>

        {/* Modaal: bewerk actie */}
        {actieEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded shadow-lg w-full max-w-2xl">
              <h3 className="text-lg font-semibold mb-2">Bewerk actie</h3>
              <input
                className="w-full border px-4 py-3 text-lg rounded mb-4"
                value={actieEdit.tekst}
                onChange={(e) => setActieEdit({ ...actieEdit, tekst: e.target.value })}
              />
              <label className="flex items-center gap-2 mb-6">
                <input
                  type="checkbox"
                  checked={actieEdit.is_weekly}
                  onChange={(e) => setActieEdit({ ...actieEdit, is_weekly: e.target.checked })}
                />
                Wekelijks
              </label>
              <div className="flex justify-between items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm("Weet je zeker dat je deze actie wilt verwijderen?")) {
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
                <button type="button" onClick={() => setActieEdit(null)} className="text-gray-600">
                  Annuleer
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await updateActie(actieEdit.id, actieEdit.tekst, actieEdit.is_weekly);
                    setActieEdit(null);
                  }}
                  className="bg-blue-600 text-white px-4 py-1 rounded"
                >
                  Opslaan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Deze week gedaan (wekelijks) */}
        {weeklyDoneThisWeek.length > 0 && (
          <details className="mt-8">
            <summary className="cursor-pointer text-sm font-semibold text-emerald-700">
              Deze week gedaan ({weeklyDoneThisWeek.length})
            </summary>
            <div className="mt-2 space-y-2">
              {weeklyDoneThisWeek.map((actie) => (
                <StaticActieRow
                  key={actie.id}
                  actie={actie}
                  isAfgehandeld={true} // zorgt voor groene container styling
                  onToggleCheck={toggleActie}
                  onEdit={(s) => setActieEdit(s)}
                  onWeeklyDone={markWeeklyDone}
                  onWeeklyUndo={undoWeeklyDone}
                />
              ))}
            </div>
          </details>
        )}

        {/* Afgehandeld (definitief) */}
        {afgehandeldSorted.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Afgehandeld</h3>
            <div className="space-y-2">
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
