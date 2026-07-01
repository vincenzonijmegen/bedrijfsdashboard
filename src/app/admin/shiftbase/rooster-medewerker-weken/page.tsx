"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { nl } from "date-fns/locale";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Printer,
  RefreshCw,
  Users,
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

type WeekInfo = {
  key: string;
  label: string;
  start: string;
  eind: string;
};

type WeekCel = {
  aantalDiensten: number;
  uren: number;
};

type MedewerkerWeekRij = {
  medewerkerId: string;
  naam: string;
  afdeling?: string;
  weken: Record<string, WeekCel>;
  totaalDiensten: number;
  totaalUren: number;
};

function vandaagIso() {
  return new Date().toISOString().slice(0, 10);
}

function eindeJaarIso() {
  const jaar = new Date().getFullYear();
  return `${jaar}-12-31`;
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

function formatDatumKort(value: string) {
  try {
    return format(parseISO(value), "dd-MM", { locale: nl });
  } catch {
    return value;
  }
}

function formatUren(value: number) {
  return value.toFixed(1).replace(".", ",");
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

function getWeekLabel(key: string) {
  const delen = key.split("-W");
  return `Week ${delen[1] ?? key}`;
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

function berekenUren(dienst: Dienst) {
  if (!dienst.starttime || !dienst.endtime) return 0;

  const [startUur, startMinuut] = dienst.starttime.split(":").map(Number);
  const [eindUur, eindMinuut] = dienst.endtime.split(":").map(Number);

  if (
    Number.isNaN(startUur) ||
    Number.isNaN(startMinuut) ||
    Number.isNaN(eindUur) ||
    Number.isNaN(eindMinuut)
  ) {
    return 0;
  }

  const start = startUur * 60 + startMinuut;
  let eind = eindUur * 60 + eindMinuut;

  if (eind < start) {
    eind += 24 * 60;
  }

  return (eind - start) / 60;
}

function maakWeken(startDatum: string, eindDatum: string): WeekInfo[] {
  const start = startOfWeek(parseISO(startDatum), { weekStartsOn: 1 });
  const eind = parseISO(eindDatum);

  const weken: WeekInfo[] = [];
  const gezien = new Set<string>();

  let cursor = start;

  while (cursor <= eind) {
    const key = getWeekKey(format(cursor, "yyyy-MM-dd"));

    if (!gezien.has(key)) {
      gezien.add(key);

      const weekStart = cursor;
      const weekEind = addDays(cursor, 6);

      weken.push({
        key,
        label: getWeekLabel(key),
        start: format(weekStart, "yyyy-MM-dd"),
        eind: format(weekEind, "yyyy-MM-dd"),
      });
    }

    cursor = addDays(cursor, 7);
  }

  return weken;
}

export default function RoosterMedewerkerWekenPage() {
  const [startDatum, setStartDatum] = useState(vandaagIso());
  const [eindDatum, setEindDatum] = useState(eindeJaarIso());

  const [medewerkers, setMedewerkers] = useState<Medewerker[]>([]);
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
    let actief = true;

    async function laadRooster() {
      if (!startDatum || !eindDatum) return;

      setLoadingRooster(true);
      setError(null);

      const params = new URLSearchParams({
        min_date: startDatum,
        max_date: eindDatum,
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

        const genormaliseerd = ruweData
          .map(normaliseerDienst)
          .filter((d): d is Dienst => Boolean(d))
          .sort((a, b) => {
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
  }, [startDatum, eindDatum]);

  const weken = useMemo(() => {
    if (!startDatum || !eindDatum) return [];
    return maakWeken(startDatum, eindDatum);
  }, [startDatum, eindDatum]);

  const tabelRijen = useMemo(() => {
    const medewerkersMap = new Map<string, Medewerker>();

    for (const medewerker of medewerkers) {
      medewerkersMap.set(String(medewerker.id), medewerker);
    }

    for (const dienst of diensten) {
      const id = String(dienst.user_id);

      if (!medewerkersMap.has(id)) {
        medewerkersMap.set(id, {
          id,
          fullName: dienst.user_name || `Medewerker ${id}`,
          department_name: dienst.department_name,
        });
      }
    }

    const rijen: MedewerkerWeekRij[] = Array.from(medewerkersMap.values())
      .filter((medewerker) => medewerker.fullName !== "Anonymous User")
      .map((medewerker) => {
        const wekenRecord: Record<string, WeekCel> = {};

        for (const week of weken) {
          wekenRecord[week.key] = {
            aantalDiensten: 0,
            uren: 0,
          };
        }

        return {
          medewerkerId: String(medewerker.id),
          naam: medewerker.fullName,
          afdeling: medewerker.department_name,
          weken: wekenRecord,
          totaalDiensten: 0,
          totaalUren: 0,
        };
      });

    const rijMap = new Map<string, MedewerkerWeekRij>();

    for (const rij of rijen) {
      rijMap.set(rij.medewerkerId, rij);
    }

    for (const dienst of diensten) {
      const medewerkerId = String(dienst.user_id);
      const weekKey = getWeekKey(dienst.date);
      const rij = rijMap.get(medewerkerId);

      if (!rij) continue;

      if (!rij.weken[weekKey]) {
        rij.weken[weekKey] = {
          aantalDiensten: 0,
          uren: 0,
        };
      }

      const uren = berekenUren(dienst);

      rij.weken[weekKey].aantalDiensten += 1;
      rij.weken[weekKey].uren += uren;
      rij.totaalDiensten += 1;
      rij.totaalUren += uren;
    }

    return rijen.sort((a, b) => {
      if (b.totaalDiensten !== a.totaalDiensten) {
        return b.totaalDiensten - a.totaalDiensten;
      }

      return a.naam.localeCompare(b.naam, "nl");
    });
  }, [medewerkers, diensten, weken]);

  const totalen = useMemo(() => {
    const totaalDiensten = tabelRijen.reduce(
      (totaal, rij) => totaal + rij.totaalDiensten,
      0
    );

    const totaalUren = tabelRijen.reduce(
      (totaal, rij) => totaal + rij.totaalUren,
      0
    );

    const medewerkersMetDiensten = tabelRijen.filter(
      (rij) => rij.totaalDiensten > 0
    ).length;

    return {
      totaalDiensten,
      totaalUren,
      medewerkersMetDiensten,
    };
  }, [tabelRijen]);

  function printOverzicht() {
    window.print();
  }

  return (
    <main
      id="printable-weekoverzicht"
      className="min-h-screen bg-slate-100 px-4 py-6"
    >
      <div className="mx-auto max-w-7xl space-y-6">
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
              Rooster per medewerker per week
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Bekijk per medewerker hoe vaak iemand per week is ingepland binnen
              de gekozen periode.
            </p>
          </div>

          <button
            type="button"
            onClick={printOverzicht}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Printer className="h-4 w-4" />
            Print overzicht
          </button>
        </div>

        <section className="hidden print:block">
          <h1 className="text-xl font-bold text-slate-900">
            Rooster per medewerker per week
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            {formatDatumKort(startDatum)} t/m {formatDatumKort(eindDatum)}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Totaal diensten: {totalen.totaalDiensten} · Totaal uren:{" "}
            {formatUren(totalen.totaalUren)}
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Startdatum
              </span>

              <input
                type="date"
                value={startDatum}
                onChange={(e) => setStartDatum(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Einddatum
              </span>

              <input
                type="date"
                value={eindDatum}
                onChange={(e) => setEindDatum(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div className="font-medium text-slate-700">Periode</div>
              <div className="mt-1">
                {formatDatumKort(startDatum)} t/m {formatDatumKort(eindDatum)}
              </div>
            </div>
          </div>
        </section>

        {error && (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm print:hidden">
            {error}
          </section>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4 print:hidden">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <CalendarDays className="h-4 w-4" />
              Weken
            </div>

            <div className="mt-2 text-2xl font-bold text-slate-900">
              {weken.length}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Users className="h-4 w-4" />
              Medewerkers ingepland
            </div>

            <div className="mt-2 text-2xl font-bold text-slate-900">
              {totalen.medewerkersMetDiensten}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Clock className="h-4 w-4" />
              Totaal diensten
            </div>

            <div className="mt-2 text-2xl font-bold text-slate-900">
              {totalen.totaalDiensten}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <RefreshCw className="h-4 w-4" />
              Status
            </div>

            <div className="mt-2 text-sm font-semibold text-slate-900">
              {loadingMedewerkers || loadingRooster
                ? "Rooster laden…"
                : "Bijgewerkt"}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-900">
              Weekoverzicht
            </h2>

            <p className="mt-1 text-xs text-slate-500 print:hidden">
              Per cel staat eerst het aantal diensten. De uren staan er klein
              onder.
            </p>
          </div>

          {loadingRooster || loadingMedewerkers ? (
            <div className="p-6 text-sm text-slate-600">
              Overzicht wordt geladen…
            </div>
          ) : tabelRijen.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">
              Geen medewerkers of diensten gevonden voor deze periode.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-white">
                    <th className="sticky left-0 z-20 min-w-[220px] border-r border-slate-200 bg-white px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Medewerker
                    </th>

                    {weken.map((week) => (
                      <th
                        key={week.key}
                        className="min-w-[92px] border-r border-slate-200 px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500"
                      >
                        <div>{week.label}</div>
                        <div className="mt-1 normal-case tracking-normal text-slate-400">
                          {formatDatumKort(week.start)}–{formatDatumKort(week.eind)}
                        </div>
                      </th>
                    ))}

                    <th className="min-w-[100px] px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                      Totaal
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {tabelRijen.map((rij) => (
                    <tr
                      key={rij.medewerkerId}
                      className="border-b border-slate-100 last:border-b-0"
                    >
                      <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-3">
                        <div className="font-semibold text-slate-900">
                          {rij.naam}
                        </div>

                        {rij.afdeling && (
                          <div className="mt-1 text-xs text-slate-500 print:hidden">
                            {rij.afdeling}
                          </div>
                        )}
                      </td>

                      {weken.map((week) => {
                        const cel = rij.weken[week.key] ?? {
                          aantalDiensten: 0,
                          uren: 0,
                        };

                        const heeftDiensten = cel.aantalDiensten > 0;

                        return (
                          <td
                            key={`${rij.medewerkerId}-${week.key}`}
                            className={`border-r border-slate-100 px-3 py-3 text-center ${
                              heeftDiensten ? "bg-blue-50/40" : "bg-white"
                            }`}
                          >
                            <div
                              className={`text-base font-bold ${
                                heeftDiensten
                                  ? "text-slate-900"
                                  : "text-slate-300"
                              }`}
                            >
                              {cel.aantalDiensten}
                            </div>

                            {heeftDiensten && (
                              <div className="mt-1 text-xs font-medium text-slate-500">
                                {formatUren(cel.uren)} u
                              </div>
                            )}
                          </td>
                        );
                      })}

                      <td className="bg-slate-50 px-3 py-3 text-center">
                        <div className="text-base font-bold text-slate-900">
                          {rij.totaalDiensten}
                        </div>

                        <div className="mt-1 text-xs font-medium text-slate-500">
                          {formatUren(rij.totaalUren)} u
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 7mm;
          }

          html,
          body {
            background: white !important;
          }

          body * {
            visibility: hidden !important;
          }

          #printable-weekoverzicht,
          #printable-weekoverzicht * {
            visibility: visible !important;
          }

          #printable-weekoverzicht {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            min-height: auto !important;
          }

          #printable-weekoverzicht .mx-auto {
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

          .rounded-2xl {
            border-radius: 5px !important;
          }

          .shadow-sm {
            box-shadow: none !important;
          }

          .space-y-6 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 5px !important;
          }

          table {
            font-size: 9px !important;
          }

          th,
          td {
            padding: 3px !important;
          }

          .text-2xl {
            font-size: 15px !important;
            line-height: 18px !important;
          }

          .text-xl {
            font-size: 14px !important;
            line-height: 17px !important;
          }

          .text-base {
            font-size: 10px !important;
            line-height: 12px !important;
          }

          .text-sm {
            font-size: 10px !important;
            line-height: 12px !important;
          }

          .text-xs {
            font-size: 8px !important;
            line-height: 10px !important;
          }

          .sticky {
            position: static !important;
          }

          .overflow-x-auto {
            overflow: visible !important;
          }

          .min-w-\\[220px\\] {
            min-width: 120px !important;
          }

          .min-w-\\[92px\\] {
            min-width: 48px !important;
          }

          .min-w-\\[100px\\] {
            min-width: 55px !important;
          }
        }
      `}</style>
    </main>
  );
}