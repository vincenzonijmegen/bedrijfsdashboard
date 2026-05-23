"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  RefreshCw,
  User,
} from "lucide-react";

type Medewerker = {
  id: string | number;
  fullName?: string;
  name?: string;
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

function overDagenIso(aantalDagen: number) {
  const d = new Date();
  d.setDate(d.getDate() + aantalDagen);
  return d.toISOString().slice(0, 10);
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

function normaliseerDienst(item: any): Dienst | null {
  const bron =
    item?.Shift ||
    item?.Schedule ||
    item?.Roster ||
    item?.PlannedShift ||
    item;

  const shiftInfo =
    item?.ShiftType ||
    item?.Shift ||
    item?.Team ||
    item?.Department ||
    {};

  const id = String(
    bron?.id ??
      item?.id ??
      `${bron?.date ?? ""}-${bron?.starttime ?? ""}-${bron?.user_id ?? ""}`
  );

  const date = String(
    bron?.date ??
      item?.date ??
      bron?.start_date ??
      item?.start_date ??
      ""
  );

  const starttime = String(
    bron?.starttime ??
      bron?.start_time ??
      item?.starttime ??
      item?.start_time ??
      ""
  );

  const endtime = String(
    bron?.endtime ??
      bron?.end_time ??
      item?.endtime ??
      item?.end_time ??
      ""
  );

  const user_id = String(
    bron?.user_id ??
      bron?.employee_id ??
      item?.user_id ??
      item?.employee_id ??
      ""
  );

  if (!date || !user_id) return null;

  return {
    id,
    date,
    starttime,
    endtime,
    user_id,
    user_name:
      bron?.user_name ??
      bron?.employee_name ??
      item?.user_name ??
      item?.employee_name,
    description:
      bron?.description ??
      item?.description ??
      shiftInfo?.description,
    shift_name:
      shiftInfo?.long_name ??
      shiftInfo?.name ??
      bron?.shift_name ??
      bron?.name,
    department_name:
      item?.department_name ??
      bron?.department_name ??
      shiftInfo?.department_name,
    color: shiftInfo?.color ?? bron?.color ?? item?.color,
  };
}

export default function RoosterPerMedewerkerPage() {
  const [medewerkers, setMedewerkers] = useState<Medewerker[]>([]);
  const [medewerkerId, setMedewerkerId] = useState("");
  const [startDatum, setStartDatum] = useState(vandaagIso());
  const [eindDatum, setEindDatum] = useState(overDagenIso(28));
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

        const lijst: Medewerker[] = Array.isArray(json?.data)
          ? json.data
              .filter((m: any) => m.fullName !== "Anonymous User")
              .sort((a: any, b: any) =>
                String(a.fullName || a.name || "").localeCompare(
                  String(b.fullName || b.name || ""),
                  "nl"
                )
              )
          : [];

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
    if (!medewerkerId || !startDatum || !eindDatum) return;

    let actief = true;

    async function laadRooster() {
      setLoadingRooster(true);
      setError(null);

      const params = new URLSearchParams({
        min_date: startDatum,
        max_date: eindDatum,
        user_id: medewerkerId,
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
  }, [medewerkerId, startDatum, eindDatum]);

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

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
              Selecteer een medewerker en periode om het ShiftBase-rooster te
              bekijken.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Geselecteerd
            </div>

            <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <User className="h-4 w-4 text-blue-600" />
              {geselecteerdeMedewerker?.fullName ||
                geselecteerdeMedewerker?.name ||
                "Geen medewerker"}
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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
                    {m.fullName || m.name || `Medewerker ${m.id}`}
                    {m.department_name ? ` — ${m.department_name}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Vanaf</span>

              <input
                type="date"
                value={startDatum}
                onChange={(e) => setStartDatum(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Tot en met
              </span>

              <input
                type="date"
                value={eindDatum}
                onChange={(e) => setEindDatum(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
        </section>

        {error && (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm">
            {error}
          </section>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

        <section className="space-y-5">
          {loadingRooster && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
              Rooster wordt geladen…
            </div>
          )}

          {!loadingRooster && diensten.length === 0 && !error && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
              Geen diensten gevonden voor deze medewerker in deze periode.
            </div>
          )}

          {!loadingRooster &&
            Object.entries(dienstenPerWeek).map(([week, weekDiensten]) => (
              <div
                key={week}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h2 className="text-sm font-bold text-slate-900">
                    Week {week.split("-W")[1]}
                  </h2>
                </div>

                <div className="divide-y divide-slate-100">
                  {weekDiensten.map((dienst) => (
                    <div
                      key={dienst.id}
                      className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[180px_140px_1fr]"
                    >
                      <div>
                        <div className="text-sm font-semibold capitalize text-slate-900">
                          {formatDatum(dienst.date)}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {formatKorteDatum(dienst.date)}
                        </div>
                      </div>

                      <div>
                        <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                          {dienst.starttime || "?"} – {dienst.endtime || "?"}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="font-medium text-slate-900">
                            {dienst.description ||
                              dienst.shift_name ||
                              "Dienst"}
                          </div>

                          {dienst.department_name && (
                            <div className="mt-1 text-sm text-slate-500">
                              {dienst.department_name}
                            </div>
                          )}
                        </div>

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
    </main>
  );
}