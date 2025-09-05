// Bestand: src/app/admin/acties/page.tsx
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
import { Pencil } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Actie {
  id: number;
  tekst: string;
  voltooid: boolean;
  deadline?: string;
  verantwoordelijke?: string;
  volgorde: number;
  is_weekly?: boolean;       // afgeleid in API (recurring='weekly')
  done_this_week?: boolean;  // afgeleid in API
}

interface ActieLijst {
  id: number;
  naam: string;
  icoon: string;
}

type EditState = { id: number; tekst: string; is_weekly: boolean };

type SorteerbareActieProps = {
  actie: Actie;
  toggleActie: (id: number, voltooid: boolean) => void;
  setActieEdit: (value: EditState | null) => void;
  markWeeklyDone: (id: number) => void;
  undoWeeklyDone: (id: number) => void;
  isAfgehandeld?: boolean;
  dnd?: boolean;
};

function SorteerbareActie({
  actie,
  toggleActie,
  setActieEdit,
  markWeeklyDone,
  undoWeeklyDone,
  isAfgehandeld,
  dnd = true,
}: SorteerbareActieProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: actie.id });

  const dragProps = dnd ? { ref: setNodeRef, ...attributes, ...listeners } : {};
  const dragStyle: React.CSSProperties = dnd
    ? { transform: CSS.Transform.toString(transform), transition, cursor: "grab", zIndex: isDragging ? 50 : 1 }
    : {};

  const containerClass = isAfgehandeld
    ? "flex items-center justify-between border p-3 rounded bg-gray-50 text-gray-500"
    : "flex items-center justify-between border p-3 rounded bg-white shadow-sm";


    return (
  <div {...dragProps} style={dragStyle} className={containerClass}>
    {/* Links: tekst (of checkbox + tekst) */}
    <div className="flex items-center gap-3 flex-1 select-none">
      {!actie.is_weekly ? (
        <>
          <input
            type="checkbox"
            checked={actie.voltooid}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={() => toggleActie(actie.id, actie.voltooid)}
          />
          <span className={isAfgehandeld ? "line-through" : ""}>{actie.tekst}</span>
        </>
      ) : (
        <span className={isAfgehandeld ? "line-through" : ""}>{actie.tekst}</span>
      )}
    </div>

    {/* Rechts: acties (knop rechts uitgelijnd) */}
    <div className="ml-auto flex items-center gap-2">
      {actie.is_weekly && !isAfgehandeld && !actie.done_this_week && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => markWeeklyDone(actie.id)}
          className="px-3 py-1 rounded bg-emerald-600 text-white text-sm"
          title="Markeer als klaar voor deze week"
        >
          Klaar voor deze week
        </button>
      )}

      {actie.is_weekly && actie.done_this_week && (
        <div className="flex items-center gap-2">
          <span className="text-green-700 text-sm">✓ Deze week gedaan</span>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => undoWeeklyDone(actie.id)}
            className="text-xs underline"
          >
            Toch terugzetten
          </button>
        </div>
      )}

      <button
        type="button"
        title="Bewerken"
        className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setActieEdit({ id: actie.id, tekst: actie.tekst, is_weekly: !!actie.is_weekly })}
      >
        <Pencil size={18} />
      </button>
    </div>
  </div>
);

}

export default function ActieLijstPagina() {
  // Lijsten ophalen
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

  // Acties ophalen (default = [])
  const { data: actiesRaw = [], mutate } = useSWR<Actie[]>(
    geselecteerdeLijst ? `/api/acties?lijst_id=${geselecteerdeLijst.id}` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30000 }
  );

  // DnD
  const [dndVolgorde, setDndVolgorde] = useState<number[]>([]);
  const sensors = useSensors(useSensor(PointerSensor));

  // Form state
  const [nieuweLijstNaam, setNieuweLijstNaam] = useState("");
  const [nieuweActieTekst, setNieuweActieTekst] = useState("");
  const [nieuweActieWeekly, setNieuweActieWeekly] = useState(false);

  const [lijstEdit, setLijstEdit] =
    useState<{ id: number; naam: string; icoon: string } | null>(null);
  const [actieEdit, setActieEdit] = useState<EditState | null>(null);

  // Init: selecteer eerste lijst
  useEffect(() => {
    if (lijsten && lijsten.length > 0 && !geselecteerdeLijst) {
      setGeselecteerdeLijst(lijsten[0]);
    }
  }, [lijsten, geselecteerdeLijst]);

  // Reset DnD-volgorde na fetch (alleen open & niet done_this_week)
  useEffect(() => {
    const openActies = actiesRaw
      .filter((a) => !a.voltooid && !(a.is_weekly && a.done_this_week))
      .sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0));
    setDndVolgorde(openActies.map((a) => a.id));
  }, [actiesRaw]);

  // Actie handlers
  const toggleActie = async (id: number, voltooid: boolean) => {
    const res = await fetch("/api/acties", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, voltooid: !voltooid }),
    });
    await res.json();
    await mutate();
  };

  const markWeeklyDone = async (id: number) => {
    await fetch("/api/acties/wekelijks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "done" }),
    });
    await mutate();
  };

  const undoWeeklyDone = async (id: number) => {
    await fetch("/api/acties/wekelijks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "undone" }),
    });
    await mutate();
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

  // Afgeleide sets
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

        {/* DRAG & DROP + AFVINKEN VOOR OPEN ACTIES */}
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
              <SorteerbareActie
                key={actie.id}
                actie={actie}
                toggleActie={toggleActie}
                setActieEdit={setActieEdit}
                markWeeklyDone={markWeeklyDone}
                undoWeeklyDone={undoWeeklyDone}
                dnd={true}
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
            <summary className="cursor-pointer text-sm text-gray-600">
              Deze week gedaan ({weeklyDoneThisWeek.length})
            </summary>
            <div className="mt-2 space-y-2">
              {weeklyDoneThisWeek.map((actie) => (
                <SorteerbareActie
                  key={actie.id}
                  actie={actie}
                  toggleActie={toggleActie}
                  setActieEdit={setActieEdit}
                  markWeeklyDone={markWeeklyDone}
                  undoWeeklyDone={undoWeeklyDone}
                  isAfgehandeld={true}
                  dnd={false}
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
                <SorteerbareActie
                  key={actie.id}
                  actie={actie}
                  toggleActie={toggleActie}
                  setActieEdit={setActieEdit}
                  markWeeklyDone={markWeeklyDone}
                  undoWeeklyDone={undoWeeklyDone}
                  isAfgehandeld={true}
                  dnd={false}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
