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

export default function SchoonmaakRoutinesPagina() {
  const { data: routines, mutate } = useSWR<Routine[]>("/api/schoonmaakroutines", fetcher);
  const [vandaag, setVandaag] = useState(dayjs());

  useEffect(() => {
    const interval = setInterval(() => setVandaag(dayjs()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const markeerAlsUitgevoerd = async (id: number) => {
    const vandaagDatum = vandaag.format("YYYY-MM-DD");
    await fetch("/api/schoonmaakroutines", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, laatst_uitgevoerd: vandaagDatum }),
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
    <div className="p-6 max-w-3xl mx-auto">
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
            <button
              onClick={() => markeerAlsUitgevoerd(routine.id)}
              className="bg-blue-600 text-white px-3 py-1 rounded"
            >
              ✔ Vandaag
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
