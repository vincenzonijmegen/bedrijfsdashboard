// Bestand: src/app/schoonmaakroutines/page.tsx
"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import dayjs from "dayjs";
import "dayjs/locale/nl";
import clsx from "clsx";

dayjs.locale("nl");

const fetcher = (url: string) => fetch(url).then((res) => res.json());


interface Routine {
  id: number;
  naam: string;
  frequentie: number;
  periode_start: number;
  periode_eind: number;
  laatst_uitgevoerd: string | null;
}

function RoutineForm({ onToegevoegd }: { onToegevoegd: () => void }) {
  const [naam, setNaam] = useState("");
  const [frequentie, setFrequentie] = useState(14);
  const [start, setStart] = useState(3);
  const [eind, setEind] = useState(9);
  const [saving, setSaving] = useState(false);

  const toevoegen = async () => {
    if (!naam.trim()) return;
    setSaving(true);
    await fetch("/api/schoonmaakroutines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ naam: naam.trim(), frequentie, periode_start: start, periode_eind: eind })
    });
    setNaam("");
    onToegevoegd();
    setSaving(false);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        toevoegen();
      }}
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
    >
      <div className="col-span-full">
        <label className="block text-sm font-medium">Naam routine</label>
        <input
          className="w-full border rounded px-3 py-2 mt-1"
          placeholder="Bijv. Zoutspoeling afwasmachine"
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Frequentie (in dagen)</label>
        <input
          type="number"
          className="w-full border rounded px-3 py-2 mt-1"
          value={frequentie}
          onChange={(e) => setFrequentie(parseInt(e.target.value))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Startmaand</label>
        <input
          type="number"
          className="w-full border rounded px-3 py-2 mt-1"
          value={start}
          min={1}
          max={12}
          onChange={(e) => setStart(parseInt(e.target.value))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Eindmaand</label>
        <input
          type="number"
          className="w-full border rounded px-3 py-2 mt-1"
          value={eind}
          min={1}
          max={12}
          onChange={(e) => setEind(parseInt(e.target.value))}
        />
      </div>

      <div className="col-span-full">
        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded mt-2"
          disabled={saving}
        >
          {saving ? 'Toevoegen...' : '➕ Toevoegen'}
        </button>
      </div>
    </div>
  );
}

function RoutineHistoriek({ id, naam }: { id: number; naam: string }) {
  const { data } = useSWR<{ datum: string }[]>(`/api/schoonmaakroutines/historiek?routine_id=${id}`, fetcher);
  return (
    <div className="mb-4">
      <div className="font-medium mb-1">{naam}</div>
      <ul className="text-sm list-disc list-inside text-gray-700">
        {Array.isArray(data) && data.length > 0 ? (
          data.map((entry, i) => (
            <li key={i}>{dayjs(entry.datum).format("D MMMM YYYY")}</li>
          ))
        ) : (
          <li className="text-gray-400">Nog geen registraties</li>
        )}
      </ul>
    </div>
  );
}

export default function SchoonmaakRoutinesPagina() {
  const { data: routines, mutate } = useSWR<Routine[]>("/api/schoonmaakroutines", fetcher);
  const [vandaag, setVandaag] = useState(dayjs());

  useEffect(() => {
    const interval = setInterval(() => setVandaag(dayjs()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const markeerAlsUitgevoerd = async (id: number, datum: string) => {
    await fetch("/api/schoonmaakroutines", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, laatst_uitgevoerd: datum }),
    });
    mutate();
  };

  const bepaalStatusKleur = (routine: Routine) => {
    const maand = vandaag.month() + 1;
    if (maand < routine.periode_start || maand > routine.periode_eind) return "text-gray-400";

    if (!routine.laatst_uitgevoerd) return "bg-red-100 text-red-700";

    const laatst = dayjs(routine.laatst_uitgevoerd);
    const dagenSinds = vandaag.diff(laatst, "day");

    if (dagenSinds >= routine.frequentie) return "bg-red-100 text-red-700";
    if (dagenSinds >= routine.frequentie - 2) return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-700";
  };

  const formatDatum = (datum: string | null) => {
    if (!datum) return "—";
    return dayjs(datum).format("D MMMM YYYY");
  };

  const berekenDueDate = (routine: Routine) => {
    if (!routine.laatst_uitgevoerd) return "—";
    return dayjs(routine.laatst_uitgevoerd).add(routine.frequentie, "day").format("D MMMM YYYY");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold mb-6">Schoonmaakroutines</h1>

      <div className="space-y-4">
        {routines?.map((routine) => (
          <div
            key={routine.id}
            className={clsx(
              "flex justify-between items-center p-4 rounded border",
              bepaalStatusKleur(routine)
            )}
          >
            <div>
              <div className="font-medium">{routine.naam}</div>
              <div className="text-sm">Laatst uitgevoerd: {formatDatum(routine.laatst_uitgevoerd)}</div>
              <div className="text-sm">Volgende keer vóór: {berekenDueDate(routine)}</div>
            </div>
            <input
              type="date"
              className="border rounded px-2 py-1"
              max={vandaag.format("YYYY-MM-DD")}
              defaultValue={vandaag.format("YYYY-MM-DD")}
              onChange={(e) => markeerAlsUitgevoerd(routine.id, e.target.value)}
            />
          </div>
        ))}
      </div>

      {/* Historiekweergave */}
      <div className="border-t pt-6">
        <h2 className="text-lg font-semibold mb-4">Historiek</h2>
        {routines?.map((routine) => (
          <RoutineHistoriek key={routine.id} id={routine.id} naam={routine.naam} />
        ))}
      </div>

      <div className="border-t pt-6">
        <h2 className="text-lg font-semibold mb-4">Nieuwe routine toevoegen</h2>
        <RoutineForm onToegevoegd={mutate} />
      </div>
    </div>
  );
}
