"use client";

import useSWR from "swr";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type HaccpTaak = {
  routineNaam: string;
  routineSlug: string;
  locatie: string | null;
  type: string | null;
  taakId: number | string;
  taakNaam: string;
  frequentie: string;
  isPeriodiek: boolean;
  dagenTeLaat: number | null;
};

type RoutineSamenvatting = {
  routineNaam: string;
  routineSlug: string;
  locatie: string | null;
  type: string | null;
  totaalTaken: number;
  afgerondTaken: number;
  openTaken: number;
  overdueTaken: number;
};

function formatRoutineNaam(slug: string, fallback: string) {
  const namen: Record<string, string> = {
    "keuken-opstart": "Start keuken",
    "keuken-afsluit": "Einde keuken",
    "keuken-eindschoonmaak": "Eindschoonmaak keuken",
    "winkel-opstart": "Start winkel",
    "winkel-afsluit": "Einde winkel",
  };

  return namen[slug] || fallback;
}

function routineVolgorde(slug: string) {
  const volgorde: Record<string, number> = {
    "winkel-opstart": 1,
    "winkel-afsluit": 2,
    "keuken-opstart": 3,
    "keuken-afsluit": 4,
    "keuken-eindschoonmaak": 5,
  };

  return volgorde[slug] || 99;
}


function frequentieLabel(frequentie: string) {
  const labels: Record<string, string> = {
    D: "Dagelijks",
    W: "Wekelijks",
    "2D": "Om de 2 dagen",
    M: "Maandelijks",
    Q: "Per kwartaal",
    H: "Halfjaarlijks",
    Y: "Jaarlijks",
  };

  return labels[frequentie] || frequentie;
}

export default function HaccpControlePage() {
  const { data, error, mutate, isLoading } = useSWR(
    "/api/admin/briefing",
    fetcher,
    {
      refreshInterval: 30000,
    }
  );

  const haccp = data?.onderdelen?.haccp;
  const haccpData = haccp?.data;

  const openTaken: HaccpTaak[] = haccpData?.openTaken || [];
  const routines: RoutineSamenvatting[] = haccpData?.routines || [];
  const samenvatting = haccpData?.samenvatting;

  const openTakenPerRoutine = openTaken.reduce<Record<string, HaccpTaak[]>>(
    (acc, taak) => {
      const key = taak.routineSlug || taak.routineNaam;

      if (!acc[key]) {
        acc[key] = [];
      }

      acc[key].push(taak);
      return acc;
    },
    {}
  );

  const routinesMetOpenTaken = routines
  .filter((routine) => routine.openTaken > 0)
  .sort((a, b) => {
    const volgorde =
      routineVolgorde(a.routineSlug) - routineVolgorde(b.routineSlug);

    if (volgorde !== 0) return volgorde;

    return String(a.routineNaam || "").localeCompare(
      String(b.routineNaam || "")
    );
  });

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Terug naar admin
            </Link>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                <ClipboardCheck className="h-4 w-4" />
                HACCP controle
              </div>

              <h1 className="text-2xl font-bold text-slate-900">
                Openstaande HACCP-taken
              </h1>

              <p className="mt-1 text-sm text-slate-600">
                Snel overzicht voor de avondcontrole: wat staat er vandaag nog open?
              </p>
            </div>

            <button
              type="button"
              onClick={() => mutate()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Vernieuwen
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
            HACCP-status laden...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
            HACCP-status kon niet worden geladen.
          </div>
        )}

        {haccp?.status === "fout" && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
            {haccp.melding || "HACCP-status kon niet worden opgehaald."}
          </div>
        )}

        {haccp?.status === "ok" && (
          <>
            <section
              className={`rounded-2xl border p-5 shadow-sm ${
                openTaken.length === 0
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-orange-200 bg-orange-50"
              }`}
            >
              <div className="flex items-start gap-3">
                {openTaken.length === 0 ? (
                  <CheckCircle2 className="mt-1 h-6 w-6 flex-none text-emerald-600" />
                ) : (
                  <AlertTriangle className="mt-1 h-6 w-6 flex-none text-orange-600" />
                )}

                <div>
                  <h2
                    className={`text-lg font-bold ${
                      openTaken.length === 0
                        ? "text-emerald-900"
                        : "text-orange-900"
                    }`}
                  >
                    {openTaken.length === 0
                      ? "Alles is afgevinkt"
                      : `${openTaken.length} HACCP-taken staan nog open`}
                  </h2>

                  <p
                    className={`mt-1 text-sm ${
                      openTaken.length === 0
                        ? "text-emerald-800"
                        : "text-orange-800"
                    }`}
                  >
                    {openTaken.length === 0
                      ? "Alle zichtbare HACCP-taken voor vandaag zijn afgerond."
                      : `${routinesMetOpenTaken.length} lijst(en) hebben nog openstaande taken.`}
                  </p>
                </div>
              </div>
            </section>

            {samenvatting && (
              <section className="grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-sm text-slate-500">Totaal vandaag</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">
                    {samenvatting.totaalTaken}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-sm text-slate-500">Afgerond</div>
                  <div className="mt-1 text-2xl font-bold text-emerald-700">
                    {samenvatting.afgerondTaken}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-sm text-slate-500">Open</div>
                  <div className="mt-1 text-2xl font-bold text-orange-700">
                    {samenvatting.openTaken}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-sm text-slate-500">Overdue periodiek</div>
                  <div className="mt-1 text-2xl font-bold text-red-700">
                    {samenvatting.overduePeriodiek}
                  </div>
                </div>
              </section>
            )}

            {openTaken.length > 0 && (
              <section className="space-y-4">
                {routinesMetOpenTaken.map((routine) => {
                  const taken = openTakenPerRoutine[routine.routineSlug] || [];

                  return (
                    <div
                      key={routine.routineSlug}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h2 className="text-lg font-bold text-slate-900">
                            {formatRoutineNaam(
                              routine.routineSlug,
                              routine.routineNaam
                            )}
                          </h2>
                          <p className="mt-1 text-sm text-slate-500">
                            {routine.afgerondTaken}/{routine.totaalTaken} afgerond
                          </p>
                        </div>

                        <span className="inline-flex w-fit rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">
                          {routine.openTaken} open
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                        {taken.map((taak) => (
                          <div
                            key={taak.taakId}
                            className="flex flex-col gap-1 p-3 md:flex-row md:items-center md:justify-between"
                          >
                            <div className="font-medium text-slate-900">
                              {taak.taakNaam}
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                                {frequentieLabel(taak.frequentie)}
                              </span>

                              {taak.isPeriodiek && (
                                <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
                                  Periodiek
                                </span>
                              )}

                              {typeof taak.dagenTeLaat === "number" &&
                                taak.dagenTeLaat > 0 && (
                                  <span className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-700">
                                    {taak.dagenTeLaat} dag(en) te laat
                                  </span>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}