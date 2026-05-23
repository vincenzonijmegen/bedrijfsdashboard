"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Printer,
  RefreshCw,
  User,
} from "lucide-react";

type Medewerker = {
  id: string;
  fullName: string;
  department_name?: string;
};

type Dienst = {
  id: string;
  date: string;
  starttime: string;
  endtime: string;
  user_id: string;
  user_name?: string;
  description?: string;
  shift_name?: string;
  department_name?: string;
  color?: string;
};

function vandaagIso() {
  return new Date().toISOString().slice(0, 10);
}

function eindeJaarIso() {
  const jaar = new Date().getFullYear();
  return `${jaar}-12-31`;
}

function formatDatum(value: string) {
  try {
    return format(parseISO(value), "EEEE d MMMM yyyy", { locale: nl });
  } catch {
    return value;
  }
}

function formatKorteDatum(value: string) {
  try {
    return format(parseISO(value), "dd-MM-yyyy", { locale: nl });
  } catch {
    return value;
  }
}

function formatTijd(value: string) {
  if (!value) return "?";
  return value.slice(0, 5);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function getWeekKey(value: string) {
  const date = parseISO(value);

  const dayNumber = (date.getDay() + 6) % 7;

  const nearestThursday = new Date(date);
  nearestThursday.setDate(date.getDate() - dayNumber + 3);

  const weekYear = nearestThursday.getFullYear();

  const firstWeekThursday = new Date(weekYear, 0, 4);
  const firstWeekDayNumber = (firstWeekThursday.getDay() + 6) % 7;
  firstWeekThursday.setDate(
    firstWeekThursday.getDate() - firstWeekDayNumber + 3
  );

  const diff = nearestThursday.getTime() - firstWeekThursday.getTime();

  const week = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));

  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

function normaliseerMedewerker(item: unknown): Medewerker | null {
  const medewerker = asRecord(item);

  const id = asString(medewerker.id);
  const naam =
    asString(medewerker.fullName) ||
    asString(medewerker.name) ||
    asString(medewerker.full_name);

  if (!id || !naam || naam === "Anonymous User") return null;

  return {
    id,
    fullName: naam,
    department_name: asString(medewerker.department_name) || undefined,
  };
}

function normaliseerDienst(item: unknown): Dienst | null {
  const itemObj = asRecord(item);

  const roster = asRecord(itemObj.Roster ?? item);
  const user = asRecord(itemObj.User);
  const shift = asRecord(itemObj.Shift);
  const department = asRecord(roster.Department ?? itemObj.Department);

  const id =
    asString(roster.occurrence_id) ||
    asString(roster.id) ||
    asString(itemObj.id) ||
    `${asString(roster.date)}-${asString(roster.starttime)}-${asString(
      roster.user_id
    )}`;

  const date = asString(roster.date);
  const starttime = asString(roster.starttime);
  const endtime = asString(roster.endtime);

  const user_id =
    asString(roster.user_id) ||
    asString(user.id) ||
    asString(itemObj.user_id) ||
    asString(itemObj.employee_id);

  if (!date || !user_id) return null;

  return {
    id,
    date,
    starttime,
    endtime,
    user_id,
    user_name:
      asString(user.name) ||
      asString(roster.user_name) ||
      asString(roster.employee_name) ||
      undefined,
    description:
      asString(roster.description) ||
      asString(shift.long_name) ||
      asString(shift.name) ||
      undefined,
    shift_name:
      asString(shift.long_name) ||
      asString(shift.name) ||
      asString(roster.name) ||
      undefined,
    department_name:
      asString(department.name) ||
      asString(roster.department_name) ||
      asString(itemObj.department_name) ||
      undefined,
    color:
      asString(shift.color) ||
      asString(roster.color) ||
      asString(itemObj.color) ||
      undefined,
  };
}

export default function RoosterPerMedewerkerPage() {
  const periode = useMemo(() => {
    const jaar = new Date().getFullYear();

    return {
      startDatum: vandaagIso(),
      eindDatum: eindeJaarIso(),
      jaar,
    };
  }, []);

  const [medewerkers, setMedewerkers] = useState<Medewerker[]>([]);
  const [medewerkerId, setMedewerkerId] = useState("");
  const [diensten, setDiensten] = useState<Dienst[]>([]);
  const [loadingMedewerkers, setLoadingMedewerkers] = useState(true);
  const [loadingRooster, setLoadingRooster] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let actief = true;

    async function laadMedewerkers() {
      setLoadingMedewerkers(true);
      setError(null);

      try {
        const res = await fetch("/api/shiftbase/medewerkers");
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.details || json?.error || "Onbekende fout");
        }

        const ruweData: unknown[] = Array.isArray(json?.data) ? json.data : [];

        const lijst = ruweData
          .map(normaliseerMedewerker)
          .filter((m): m is Medewerker => Boolean(m))
          .sort((a, b) => a.fullName.localeCompare(b.fullName, "nl"));

        if (!actief) return;

        setMedewerkers(lijst);

        if (lijst.length > 0) {
          setMedewerkerId(String(lijst[0].id));
        }
      } catch (err) {
        if (!actief) return;
        setError(`Medewerkers ophalen mislukt: ${String(err)}`);
      } finally {
        if (actief) {
          setLoadingMedewerkers(false);
        }
      }
    }

    laadMedewerkers();

    return () => {
      actief = false;
    };
  }, []);

  useEffect(() => {
    if (!medewerkerId || !periode.startDatum || !periode.eindDatum) return;

    let actief = true;

    async function laadRooster() {
      setLoadingRooster(true);
      setError(null);

      const params = new URLSearchParams({
        min_date: periode.startDatum,
        max_date: periode.eindDatum,
      });

      try {
        const res = await fetch(
          `/api/shiftbase/medewerkerrooster?${params.toString()}`
        );

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.details || json?.error || "Onbekende fout");
        }

        const ruweData: unknown[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
            ? json.data
            : [];

        const genormaliseerd: Dienst[] = ruweData
          .map((item) => normaliseerDienst(item))
          .filter((d): d is Dienst => Boolean(d))
          .filter((d) => String(d.user_id) === String(medewerkerId))
          .sort((a: Dienst, b: Dienst) => {
            const datumVergelijking = a.date.localeCompare(b.date);
            if (datumVergelijking !== 0) return datumVergelijking;
            return a.starttime.localeCompare(b.starttime);
          });

        if (actief) {
          setDiensten(genormaliseerd);
        }
      } catch (err) {
        if (actief) {
          setDiensten([]);
          setError(`Rooster ophalen mislukt: ${String(err)}`);
        }
      } finally {
        if (actief) {
          setLoadingRooster(false);
        }
      }
    }

    laadRooster();

    return () => {
      actief = false;
    };
  }, [medewerkerId, periode.startDatum, periode.eindDatum]);

  const geselecteerdeMedewerker = useMemo(() => {
    return medewerkers.find((m) => String(m.id) === String(medewerkerId));
  }, [medewerkers, medewerkerId]);

  const dienstenPerWeek = useMemo(() => {
    const grouped: Record<string, Dienst[]> = {};

    for (const dienst of diensten) {
      const week = getWeekKey(dienst.date);
      if (!grouped[week]) grouped[week] = [];
      grouped[week].push(dienst);
    }

    return grouped;
  }, [diensten]);

  const weekStatistieken = useMemo(() => {
    const aantallen = Object.values(dienstenPerWeek).map(
      (weekDiensten) => weekDiensten.length
    );

    if (aantallen.length === 0) {
      return {
        minimum: 0,
        maximum: 0,
        gemiddeld: 0,
      };
    }

    const minimum = Math.min(...aantallen);
    const maximum = Math.max(...aantallen);
    const gemiddeld =
      aantallen.reduce((totaal, aantal) => totaal + aantal, 0) /
      aantallen.length;

    return {
      minimum,
      maximum,
      gemiddeld,
    };
  }, [dienstenPerWeek]);

  const totaalUren = useMemo(() => {
    return diensten.reduce((totaal, dienst) => {
      if (!dienst.starttime || !dienst.endtime) return totaal;

      const [startUur, startMinuut] = dienst.starttime.split(":").map(Number);
      const [eindUur, eindMinuut] = dienst.endtime.split(":").map(Number);

      if (
        Number.isNaN(startUur) ||
        Number.isNaN(startMinuut) ||
        Number.isNaN(eindUur) ||
        Number.isNaN(eindMinuut)
      ) {
        return totaal;
      }

      const start = startUur * 60 + startMinuut;
      let eind = eindUur * 60 + eindMinuut;

      if (eind < start) {
        eind += 24 * 60;
      }

      return totaal + (eind - start) / 60;
    }, 0);
  }, [diensten]);

  function printRooster() {
    window.print();
  }

  return (
    <main
      id="printable-rooster"
      className="min-h-screen bg-slate-100 px-4 py-6"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div>
            <Link
              href="/admin"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Terug naar management portaal
            </Link>

            <h1 className="text-2xl font-bold text-slate-900">
              Rooster per medewerker
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Selecteer een medewerker om het ShiftBase-rooster vanaf vandaag
              tot het einde van het jaar te bekijken.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Geselecteerd
              </div>

              <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <User className="h-4 w-4 text-blue-600" />
                {geselecteerdeMedewerker?.fullName || "Geen medewerker"}
              </div>
            </div>

            <button
              type="button"
              onClick={printRooster}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Printer className="h-4 w-4" />
              Print rooster
            </button>
          </div>
        </div>

        <section className="hidden print:block">
          <h1 className="text-xl font-bold text-slate-900">
            Rooster {geselecteerdeMedewerker?.fullName || ""}
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Vanaf vandaag t/m 31 december {periode.jaar}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Totaal diensten: {diensten.length} · Totaal uren:{" "}
            {totaalUren.toFixed(1)} · Gemiddeld per week:{" "}
            {weekStatistieken.gemiddeld.toFixed(1)}
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                Medewerker
              </span>

              <select
                value={medewerkerId}
                onChange={(e) => setMedewerkerId(e.target.value)}
                disabled={loadingMedewerkers}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {loadingMedewerkers && (
                  <option value="">Medewerkers laden…</option>
                )}

                {!loadingMedewerkers && medewerkers.length === 0 && (
                  <option value="">Geen medewerkers gevonden</option>
                )}

                {medewerkers.map((m) => (
                  <option key={String(m.id)} value={String(m.id)}>
                    {m.fullName}
                    {m.department_name ? ` — ${m.department_name}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div className="font-medium text-slate-700">Periode</div>
              <div className="mt-1">
                Vanaf vandaag t/m 31 december {periode.jaar}
              </div>
            </div>
          </div>
        </section>

        {error && (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm print:hidden">
            {error}
          </section>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3 print:hidden">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <CalendarDays className="h-4 w-4" />
              Diensten
            </div>

            <div className="mt-2 text-2xl font-bold text-slate-900">
              {diensten.length}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Clock className="h-4 w-4" />
              Totaal uren
            </div>

            <div className="mt-2 text-2xl font-bold text-slate-900">
              {totaalUren.toFixed(1)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <RefreshCw className="h-4 w-4" />
              Status
            </div>

            <div className="mt-2 text-sm font-semibold text-slate-900">
              {loadingRooster ? "Rooster laden…" : "Bijgewerkt"}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3 print:hidden">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-medium text-slate-500">
              Minimum diensten per week
            </div>

            <div className="mt-2 text-2xl font-bold text-slate-900">
              {weekStatistieken.minimum}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-medium text-slate-500">
              Maximum diensten per week
            </div>

            <div className="mt-2 text-2xl font-bold text-slate-900">
              {weekStatistieken.maximum}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-medium text-slate-500">
              Gemiddeld aantal diensten per week
            </div>

            <div className="mt-2 text-2xl font-bold text-slate-900">
              {weekStatistieken.gemiddeld.toFixed(1)}
            </div>
          </div>
        </section>

        <section className="space-y-5 print:space-y-1">
          {loadingRooster && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm print:hidden">
              Rooster wordt geladen…
            </div>
          )}

          {!loadingRooster && diensten.length === 0 && !error && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
              Geen diensten gevonden voor deze medewerker vanaf vandaag tot het
              einde van het jaar.
            </div>
          )}

          {!loadingRooster &&
            Object.entries(dienstenPerWeek).map(([week, weekDiensten]) => (
              <div
                key={week}
                className="rooster-week overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 print:px-2 print:py-1">
                  <h2 className="text-sm font-bold text-slate-900">
                    Week {week.split("-W")[1]}
                  </h2>
                </div>

                <div className="divide-y divide-slate-100">
                  {weekDiensten.map((dienst) => (
                    <div
                      key={dienst.id}
                      className="rooster-regel grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[180px_140px_1fr_24px] print:grid-cols-[130px_95px_1fr_24px] print:gap-2 print:px-2 print:py-1"
                    >
                      <div>
                        <div className="text-sm font-semibold capitalize text-slate-900">
                          {formatDatum(dienst.date)}
                        </div>

                        <div className="mt-1 text-xs text-slate-500 print:hidden">
                          {formatKorteDatum(dienst.date)}
                        </div>
                      </div>

                      <div>
                        <div className="inline-flex whitespace-nowrap rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 print:px-1 print:py-0">
                          {formatTijd(dienst.starttime)} –{" "}
                          {formatTijd(dienst.endtime)}
                        </div>
                      </div>

                      <div>
                        <div className="font-medium text-slate-900">
                          {dienst.description || dienst.shift_name || "Dienst"}
                        </div>

                        {dienst.department_name && (
                          <div className="mt-1 text-sm text-slate-500 print:hidden">
                            {dienst.department_name}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-end">
                        {dienst.color && (
                          <span
                            className="h-4 w-4 rounded-full border border-slate-200"
                            style={{ backgroundColor: dienst.color }}
                            title="ShiftBase-kleur"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </section>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }

          html,
          body {
            background: white !important;
          }

          body * {
            visibility: hidden !important;
          }

          #printable-rooster,
          #printable-rooster * {
            visibility: visible !important;
          }

          #printable-rooster {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            min-height: auto !important;
          }

          #printable-rooster .mx-auto {
            max-width: none !important;
            width: 100% !important;
            margin: 0 !important;
          }

          .print\\:hidden {
            display: none !important;
            visibility: hidden !important;
          }

          .print\\:block {
            display: block !important;
          }

          section {
            break-inside: auto !important;
            page-break-inside: auto !important;
          }

          .rooster-week {
            break-inside: auto !important;
            page-break-inside: auto !important;
            margin-top: 5px !important;
          }

          .rooster-regel {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .rounded-2xl {
            border-radius: 5px !important;
          }

          .shadow-sm {
            box-shadow: none !important;
          }

          .space-y-6 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 5px !important;
          }

          .space-y-5 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 4px !important;
          }

          .print\\:space-y-1 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 3px !important;
          }

          .grid {
            gap: 4px !important;
          }

          .px-4 {
            padding-left: 5px !important;
            padding-right: 5px !important;
          }

          .py-4,
          .py-3 {
            padding-top: 3px !important;
            padding-bottom: 3px !important;
          }

          .p-4 {
            padding: 5px !important;
          }

          .p-6 {
            padding: 6px !important;
          }

          .border {
            border-color: #d1d5db !important;
          }

          .border-b {
            border-bottom-color: #d1d5db !important;
          }

          .text-2xl {
            font-size: 16px !important;
            line-height: 19px !important;
          }

          .text-xl {
            font-size: 15px !important;
            line-height: 18px !important;
          }

          .text-sm {
            font-size: 11px !important;
            line-height: 14px !important;
          }

          .text-xs {
            font-size: 9.5px !important;
            line-height: 12px !important;
          }

          .font-bold {
            font-weight: 700 !important;
          }

          .divide-y > :not([hidden]) ~ :not([hidden]) {
            border-top-width: 1px !important;
          }

          .print\\:grid-cols-\\[130px_95px_1fr_24px\\] {
            grid-template-columns: 130px 95px 1fr 24px !important;
          }

          .print\\:gap-2 {
            gap: 4px !important;
          }

          .print\\:px-2 {
            padding-left: 5px !important;
            padding-right: 5px !important;
          }

          .print\\:py-1 {
            padding-top: 2px !important;
            padding-bottom: 2px !important;
          }

          .print\\:px-1 {
            padding-left: 3px !important;
            padding-right: 3px !important;
          }

          .print\\:py-0 {
            padding-top: 0 !important;
            padding-bottom: 0 !important;
          }

          .inline-flex.rounded-full {
            white-space: nowrap !important;
            background: transparent !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }

          .h-4.w-4.rounded-full {
            width: 12px !important;
            height: 12px !important;
          }
        }
      `}</style>
    </main>
  );
}