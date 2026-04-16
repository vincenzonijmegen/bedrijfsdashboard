"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";

type Taak = {
  id: number;
  naam: string;
  kleurcode: "roze" | "groen" | "geel" | null;
  reinigen: boolean;
  desinfecteren: boolean;
  frequentie: "D" | "W" | "2D";
  weekdagen: string[];
  sortering: number;
  afgetekend_door_naam: string | null;
  afgetekend_op: string | null;
  isRotatie?: boolean;
  rotatieItemId?: number;
};

type RoutineResponse = {
  datum: string;
  routine: {
    id: number;
    slug: string;
    naam: string;
    locatie: string;
    type: string;
  };
  taken: Taak[];
  totaal: number;
  afgerond: number;
};

type IngeklokteMedewerker = {
  id: string;
  name: string;
};

type RotatieItem = {
  id: number;
  naam: string;
  sortering: number;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("Fout bij laden");
  }

  return res.json();
};

const kleurStyleMap: Record<string, string> = {
  roze: "bg-pink-100 text-pink-900 border-pink-200",
  groen: "bg-green-100 text-green-900 border-green-200",
  geel: "bg-yellow-100 text-yellow-900 border-yellow-200",
};

const kleurUitlegMap: Record<string, string> = {
  roze: "Roze doek · mag met ijs in aanraking komen",
  groen: "Groene doek · normale schoonmaak",
  geel: "Gele doek · vieze dingen zoals vloer/afval",
};

function ActieBadge({ actief, label }: { actief: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border ${
        actief
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white text-slate-400 border-slate-200"
      }`}
    >
      {label}
    </span>
  );
}

export default function RoutinePagina({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [medewerkerId, setMedewerkerId] = useState<string>("");
  const [savingTaskId, setSavingTaskId] = useState<number | null>(null);
  const [message, setMessage] = useState<string>("");
  const [showRotatieMenu, setShowRotatieMenu] = useState(false);

  const [slugState, setSlugState] = useState<string | null>(null);

  useMemo(() => {
    params.then((value) => setSlugState(value.slug));
  }, [params]);

  const { data, mutate, error } = useSWR<RoutineResponse>(
    slugState ? `/api/routines/today/${slugState}` : null,
    fetcher
  );

  const { data: ingekloktData } = useSWR<IngeklokteMedewerker[]>(
    "/api/shiftbase/ingeklokt",
    fetcher,
    {
      refreshInterval: 30000,
    }
  );

  const { data: rotatieItemsData } = useSWR<{ items: RotatieItem[] }>(
    data?.routine?.id
      ? `/api/routines/rotatie/items?routineId=${data.routine.id}`
      : null,
    fetcher
  );

  const rotatieItems = rotatieItemsData?.items || [];
  const medewerkers = ingekloktData || [];
  const selectedMedewerker =
    medewerkers.find((m) => m.id === medewerkerId) || null;

  async function tekenAf(taak: Taak) {
    if (!selectedMedewerker) {
      setMessage("Kies eerst een ingeklokte medewerker.");
      return;
    }

    try {
      setSavingTaskId(taak.id);
      setMessage("");

      const res = await fetch("/api/routines/aftekenen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routineTaakId: taak.id,
          medewerkerId: selectedMedewerker.id,
          medewerkerNaam: selectedMedewerker.name,
          isRotatie: taak.isRotatie ?? false,
          rotatieItemId: taak.rotatieItemId ?? null,
          routineId: data?.routine.id ?? null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Opslaan mislukt");
      }

      await mutate();
      setSelectedTaskId(null);
      setMessage("Taak afgetekend.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Opslaan mislukt");
    } finally {
      setSavingTaskId(null);
    }
  }

  if (error) {
    return <div className="p-6">Fout bij laden van routine.</div>;
  }

  if (!data) {
    return <div className="p-6">Routine laden...</div>;
  }

  const progress =
    data.totaal > 0 ? Math.round((data.afgerond / data.totaal) * 100) : 0;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        <div className="sticky top-0 z-20 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur md:p-6">
          <div className="mb-4">
            <Link
              href={data.routine.locatie === "winkel" ? "/winkel" : "/keuken"}
              className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              ← Terug
            </Link>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-slate-500">
                {data.routine.locatie} · {data.routine.type}
              </p>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
                {data.routine.naam}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Datum: {new Date(data.datum).toLocaleDateString("nl-NL")}
              </p>
            </div>

            <div className="w-full space-y-3 md:w-80">
              <label className="block text-sm font-medium text-slate-700">
                Aftekenen als
              </label>
              <select
                value={medewerkerId}
                onChange={(e) => setMedewerkerId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base"
              >
                <option value="">Kies ingeklokte medewerker</option>
                {medewerkers.map((medewerker) => (
                  <option key={medewerker.id} value={medewerker.id}>
                    {medewerker.name}
                  </option>
                ))}
              </select>
              <div className="text-xs text-slate-500">
                Alleen medewerkers die nu ingeklokt zijn via Shiftbase zijn
                kiesbaar.
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
              <span>Voortgang</span>
              <span>
                {data.afgerond}/{data.totaal}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-3 rounded-full bg-slate-900 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(kleurUitlegMap).map(([kleur, tekst]) => (
            <div
              key={kleur}
              className={`rounded-2xl border p-3 text-sm ${kleurStyleMap[kleur]}`}
            >
              {tekst}
            </div>
          ))}
        </div>

        {message ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            {message}
          </div>
        ) : null}

        <div className="space-y-3">
          {data.taken.map((taak, index) => {
            const open = selectedTaskId === taak.id;
            const isDone = Boolean(taak.afgetekend_op);
            const kleurClass = taak.kleurcode
              ? kleurStyleMap[taak.kleurcode]
              : "bg-white text-slate-700 border-slate-200";

            return (
              <section
                key={taak.id}
                onContextMenu={(e) => {
                  if (!taak.isRotatie) return;
                  e.preventDefault();
                  setShowRotatieMenu(true);
                }}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex gap-4">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                      {index + 1}
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-slate-900">
                          {taak.naam}
                        </h2>

                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${kleurClass}`}
                        >
                          {taak.kleurcode
                            ? `${taak.kleurcode}e doek`
                            : "geen doekcode"}
                        </span>

                        <span className="inline-flex rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
                          {taak.frequentie}
                        </span>

                        {taak.isRotatie && (
                          <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                            rotatie
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <ActieBadge actief={taak.reinigen} label="Reinigen" />
                        <ActieBadge
                          actief={taak.desinfecteren}
                          label="Desinfecteren"
                        />
                        {taak.weekdagen?.length ? (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {taak.weekdagen.join(", ")}
                          </span>
                        ) : null}
                      </div>

                      {isDone ? (
                        <p className="text-sm text-green-700">
                          Afgetekend door{" "}
                          <strong>{taak.afgetekend_door_naam}</strong>
                          {taak.afgetekend_op
                            ? ` om ${new Date(
                                taak.afgetekend_op
                              ).toLocaleTimeString("nl-NL", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`
                            : ""}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-500">
                          Nog niet afgetekend.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 md:flex-col md:items-end">
                    {taak.isRotatie && (
                      <button
                        onClick={() => setShowRotatieMenu(true)}
                        className="rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700"
                      >
                        Rotatie
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedTaskId(open ? null : taak.id)}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                    >
                      {open
                        ? "Sluiten"
                        : isDone
                        ? "Opnieuw aftekenen"
                        : "Aftekenen"}
                    </button>
                  </div>
                </div>

                {open ? (
                  <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm text-slate-600">
                      Deze taak wordt afgetekend op naam van{" "}
                      <strong>{selectedMedewerker?.name || "..."}</strong>.
                    </p>

                    <button
                      onClick={() => tekenAf(taak)}
                      disabled={
                        !selectedMedewerker || savingTaskId === taak.id
                      }
                      className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {savingTaskId === taak.id
                        ? "Opslaan..."
                        : "Definitief aftekenen"}
                    </button>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>

      {showRotatieMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-4 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">
              Rotatie beheren
            </h2>

            <button
              onClick={async () => {
                try {
                  setMessage("");

                  const res = await fetch("/api/routines/rotatie/volgende", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ routineId: data?.routine.id }),
                  });

                  const json = await res.json();
                  if (!res.ok) {
                    throw new Error(json?.error || "Doorschuiven mislukt");
                  }

                  setShowRotatieMenu(false);
                  await mutate();
                  setMessage("Rotatietaak doorgeschoven.");
                } catch (err) {
                  setMessage(
                    err instanceof Error
                      ? err.message
                      : "Doorschuiven mislukt"
                  );
                }
              }}
              className="w-full rounded-xl border px-4 py-3 text-left"
            >
              ➜ Volgende taak
            </button>

            {rotatieItems.length > 0 && (
              <div className="space-y-2">
                <div className="px-1 text-sm font-medium text-slate-500">
                  Andere taak kiezen
                </div>

                {rotatieItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={async () => {
                      try {
                        setMessage("");

                        const res = await fetch("/api/routines/rotatie/set", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            routineId: data?.routine.id,
                            rotatieItemId: item.id,
                          }),
                        });

                        const json = await res.json();
                        if (!res.ok) {
                          throw new Error(
                            json?.error || "Kiezen van rotatietaak mislukt"
                          );
                        }

                        setShowRotatieMenu(false);
                        await mutate();
                        setMessage(`Rotatietaak ingesteld op: ${item.naam}`);
                      } catch (err) {
                        setMessage(
                          err instanceof Error
                            ? err.message
                            : "Kiezen van rotatietaak mislukt"
                        );
                      }
                    }}
                    className="w-full rounded-xl border px-4 py-3 text-left"
                  >
                    {item.naam}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={async () => {
                try {
                  setMessage("");

                  const res = await fetch("/api/routines/rotatie/set", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      routineId: data?.routine.id,
                      rotatieItemId: null,
                    }),
                  });

                  const json = await res.json();
                  if (!res.ok) {
                    throw new Error(json?.error || "Overslaan mislukt");
                  }

                  setShowRotatieMenu(false);
                  await mutate();
                  setMessage("Vandaag staat er geen rotatietaak ingepland.");
                } catch (err) {
                  setMessage(
                    err instanceof Error ? err.message : "Overslaan mislukt"
                  );
                }
              }}
              className="w-full rounded-xl border px-4 py-3 text-left"
            >
              ⏭ Vandaag overslaan
            </button>

            <button
              onClick={() => setShowRotatieMenu(false)}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-white"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}
    </main>
  );
}