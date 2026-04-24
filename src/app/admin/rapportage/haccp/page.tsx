"use client";

import Link from "next/link";
import useSWR from "swr";
import { useMemo, useState } from "react";

type FilterRoutine = {
  id: number;
  naam: string;
};

type Onderdeel = {
  taakId: number;
  taakNaam: string;
  sortering: number;
  afgehandeld: boolean;
  medewerkerNaam: string | null;
  afgetekendOp: string | null;
};

type RoutineRapport = {
  routineId: number;
  routineNaam: string;
  routineSlug: string | null;
  locatie: string | null;
  type: string | null;
  totaal: number;
  afgehandeld: number;
  onderdelen: Onderdeel[];
};

type HaccpResponse = {
  success: boolean;
  datum: string;
  filters: FilterRoutine[];
  routines: RoutineRapport[];
};

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((res) => {
    if (!res.ok) {
      throw new Error("Fout bij laden");
    }
    return res.json();
  });

function formatTijd(value: string | null) {
  if (!value) return "";
  const datum = new Date(value);
  if (Number.isNaN(datum.getTime())) return "";
  return datum.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function todayString() {
  const now = new Date();
  const jaar = now.getFullYear();
  const maand = String(now.getMonth() + 1).padStart(2, "0");
  const dag = String(now.getDate()).padStart(2, "0");
  return `${jaar}-${maand}-${dag}`;
}

export default function HaccpRapportagePage() {
  const [datum, setDatum] = useState(todayString());
  const [routineId, setRoutineId] = useState("all");

  const url = useMemo(() => {
    const params = new URLSearchParams();
    params.set("datum", datum);
    params.set("routineId", routineId);
    return `/api/rapportage/haccp?${params.toString()}`;
  }, [datum, routineId]);

  const { data, error, isLoading } = useSWR<HaccpResponse>(url, fetcher, {
    revalidateOnFocus: false,
  });

  if (error) {
    return <div className="p-6 text-red-600">Fout bij laden van HACCP-rapportage.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mt-4">HACCP-rapportage</h1>
        <p className="text-sm text-gray-600 mt-1">
          Bekijk per dag en per lijst wie onderdelen heeft afgehandeld.
        </p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Datum</label>
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Lijst</label>
            <select
              value={routineId}
              onChange={(e) => setRoutineId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="all">Alle lijsten</option>
              {data?.filters?.map((routine) => (
                <option key={routine.id} value={String(routine.id)}>
                  {routine.naam}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isLoading && <div className="text-sm text-gray-600">Bezig met laden...</div>}

      {!isLoading && data && data.routines.length === 0 && (
        <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">
          Geen onderdelen gevonden voor deze selectie.
        </div>
      )}

      <div className="space-y-5">
        {data?.routines.map((routine) => {
          const allesAf = routine.totaal > 0 && routine.afgehandeld === routine.totaal;

          return (
            <section
              key={routine.routineId}
              className="overflow-hidden rounded-2xl border bg-white shadow-sm"
            >
              <div className="border-b bg-gray-50 px-4 py-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{routine.routineNaam}</h2>
                    <div className="text-sm text-gray-600">
                      {[routine.locatie, routine.type].filter(Boolean).join(" • ")}
                    </div>
                  </div>

                  <div
                    className={[
                      "inline-flex w-fit rounded-full px-3 py-1 text-sm font-medium",
                      allesAf
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-800",
                    ].join(" ")}
                  >
                    {routine.afgehandeld}/{routine.totaal} afgehandeld
                  </div>
                </div>
              </div>

              <div className="divide-y">
                {routine.onderdelen.map((onderdeel) => (
                  <div
                    key={onderdeel.taakId}
                    className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="font-medium">{onderdeel.taakNaam}</div>
                    </div>

                    <div className="text-sm md:text-right">
                      {onderdeel.afgehandeld ? (
                        <div className="space-y-1">
                          <div className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-green-700">
                            Afgehandeld
                          </div>
                          <div className="text-gray-700">
                            Door <span className="font-medium">{onderdeel.medewerkerNaam ?? "Onbekend"}</span>
                            {onderdeel.afgetekendOp
                              ? ` om ${formatTijd(onderdeel.afgetekendOp)}`
                              : ""}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-red-700">
                            Niet afgehandeld
                          </div>
                          <div className="text-gray-500">
                            Geen aftekening op deze datum
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}