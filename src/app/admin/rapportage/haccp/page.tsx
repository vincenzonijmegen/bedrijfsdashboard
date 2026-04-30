"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react";

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
    if (!res.ok) throw new Error("Fout bij laden");
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
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`;
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

  const totaalTaken =
    data?.routines.reduce((sum, r) => sum + Number(r.totaal || 0), 0) ?? 0;

  const totaalAfgehandeld =
    data?.routines.reduce((sum, r) => sum + Number(r.afgehandeld || 0), 0) ?? 0;

  const allesAf = totaalTaken > 0 && totaalTaken === totaalAfgehandeld;

  if (error) {
    return (
      <main className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
          Fout bij laden van HACCP-rapportage.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
                <CalendarCheck className="h-4 w-4" />
                Rapportage / HACCP
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                HACCP-rapportage
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Bekijk per dag en per lijst wie onderdelen heeft afgehandeld.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              <div className="rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
                <div className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Taken
                </div>
                <div className="text-2xl font-bold text-blue-950">
                  {totaalTaken}
                </div>
              </div>

              <div
                className={`rounded-xl px-4 py-3 ring-1 ${
                  allesAf
                    ? "bg-emerald-50 ring-emerald-100"
                    : "bg-amber-50 ring-amber-100"
                }`}
              >
                <div
                  className={`text-xs font-medium uppercase tracking-wide ${
                    allesAf ? "text-emerald-600" : "text-amber-700"
                  }`}
                >
                  Afgehandeld
                </div>
                <div
                  className={`text-2xl font-bold ${
                    allesAf ? "text-emerald-950" : "text-amber-950"
                  }`}
                >
                  {totaalAfgehandeld}/{totaalTaken}
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Datum
              </span>
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label>
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Lijst
              </span>
              <select
                value={routineId}
                onChange={(e) => setRoutineId(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">Alle lijsten</option>
                {data?.filters?.map((routine) => (
                  <option key={routine.id} value={String(routine.id)}>
                    {routine.naam}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
            <p className="text-sm text-slate-500">HACCP-rapportage laden…</p>
          </div>
        )}

        {!isLoading && data && data.routines.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
            Geen onderdelen gevonden voor deze selectie.
          </div>
        )}

        <div className="space-y-5">
          {data?.routines.map((routine) => {
            const routineCompleet =
              routine.totaal > 0 && routine.afgehandeld === routine.totaal;

            return (
              <section
                key={routine.routineId}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-950">
                        {routine.routineNaam}
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        {[routine.locatie, routine.type]
                          .filter(Boolean)
                          .join(" • ") || "Geen categorie"}
                      </p>
                    </div>

                    <span
                      className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
                        routineCompleet
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-amber-50 text-amber-800 ring-amber-200"
                      }`}
                    >
                      {routineCompleet ? (
                        <CheckCircle2 size={15} />
                      ) : (
                        <XCircle size={15} />
                      )}
                      {routine.afgehandeld}/{routine.totaal} afgehandeld
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {routine.onderdelen.map((onderdeel) => (
                    <div
                      key={onderdeel.taakId}
                      className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="font-semibold text-slate-950">
                        {onderdeel.taakNaam}
                      </div>

                      <div className="text-sm md:text-right">
                        {onderdeel.afgehandeld ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                              <CheckCircle2 size={13} />
                              Afgehandeld
                            </span>

                            <div className="text-slate-600">
                              Door{" "}
                              <span className="font-semibold text-slate-800">
                                {onderdeel.medewerkerNaam ?? "Onbekend"}
                              </span>
                              {onderdeel.afgetekendOp
                                ? ` om ${formatTijd(onderdeel.afgetekendOp)}`
                                : ""}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-100">
                              <XCircle size={13} />
                              Niet afgehandeld
                            </span>

                            <div className="text-slate-500">
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
    </main>
  );
}