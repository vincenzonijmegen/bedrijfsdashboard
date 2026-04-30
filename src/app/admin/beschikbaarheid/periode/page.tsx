"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
} from "lucide-react";

interface Regel {
  id: number;
  medewerker_id: number;
  naam: string;
  startdatum: string;
  einddatum: string;
  max_shifts_per_week: number;
  opmerkingen?: string;
  [key: string]: any;
}

const dagen = [
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
  "zondag",
];

const dagKort = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

function getISOWeek(d: Date) {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
}

function getMondayOfISOWeek(year: number, week: number) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const isoDow = (dow + 6) % 7;
  simple.setDate(simple.getDate() - isoDow);
  return simple;
}

export default function BeschikbaarheidWeek() {
  const today = new Date();
  const [jaar, setJaar] = useState(today.getFullYear());
  const [week, setWeek] = useState(getISOWeek(today));

  const weekStart = useMemo(() => getMondayOfISOWeek(jaar, week), [jaar, week]);

  const weekDates = useMemo(() => {
    return Array.from(
      { length: 7 },
      (_, i) =>
        new Date(
          weekStart.getFullYear(),
          weekStart.getMonth(),
          weekStart.getDate() + i
        )
    );
  }, [weekStart]);

  const weekEnd = weekDates[6];

  const { data, error } = useSWR<Regel[]>("/api/beschikbaarheid", (url: string) =>
    fetch(url).then((r) => r.json())
  );

  const perMedewerker = useMemo(() => {
    if (!data) return {} as Record<number, Regel[]>;

    const map: Record<number, Regel[]> = {};

    data.forEach((regel) => {
      const rs = new Date(regel.startdatum);
      const re = new Date(regel.einddatum);

      if (!(re < weekStart || rs > weekEnd)) {
        (map[regel.medewerker_id] ||= []).push(regel);
      }
    });

    Object.values(map).forEach((arr) =>
      arr.sort(
        (a, b) =>
          new Date(a.startdatum).getTime() - new Date(b.startdatum).getTime()
      )
    );

    return map;
  }, [data, weekStart, weekEnd]);

  const medewerkersAantal = Object.keys(perMedewerker).length;

  const changeWeek = (offset: number) => {
    const next = getMondayOfISOWeek(jaar, week);
    next.setDate(next.getDate() + offset * 7);
    setJaar(next.getFullYear());
    setWeek(getISOWeek(next));
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
          Fout bij laden beschikbaarheid.
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Beschikbaarheid laden…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
                <CalendarDays className="h-4 w-4" />
                Planning / Beschikbaarheid
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Beschikbaarheid per week
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Periode: {weekStart.toLocaleDateString("nl-NL")} t/m{" "}
                {weekEnd.toLocaleDateString("nl-NL")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => changeWeek(-1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100"
              >
                <ChevronLeft size={18} />
              </button>

              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span className="text-sm font-semibold text-slate-600">Jaar</span>
                <input
                  type="number"
                  value={jaar}
                  onChange={(e) => setJaar(Number(e.target.value))}
                  className="w-20 bg-transparent text-sm font-semibold outline-none"
                  min={2000}
                  max={2100}
                />
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span className="text-sm font-semibold text-slate-600">Week</span>
                <input
                  type="number"
                  value={week}
                  onChange={(e) => setWeek(Number(e.target.value))}
                  className="w-14 bg-transparent text-sm font-semibold outline-none"
                  min={1}
                  max={53}
                />
              </label>

              <button
                onClick={() => changeWeek(1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100"
              >
                <ChevronRight size={18} />
              </button>

              <div className="ml-0 rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100 xl:ml-3">
                <div className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Medewerkers
                </div>
                <div className="text-2xl font-bold text-blue-950">
                  {medewerkersAantal}
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                <Users size={20} />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Weekoverzicht
                </h2>
                <p className="text-sm text-slate-500">
                  Groene vinkjes betekenen beschikbaar voor die shift.
                </p>
              </div>
            </div>
          </div>

          {medewerkersAantal === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              Geen beschikbaarheid gevonden voor deze week.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-3 text-left">
                      Naam
                    </th>

                    {weekDates.map((d, idx) => (
                      <React.Fragment key={d.toISOString()}>
                        <th className="border-b border-slate-200 px-2 py-3 text-center">
                          {dagKort[idx]} {d.getDate()} S1
                        </th>
                        <th className="border-b border-slate-200 px-2 py-3 text-center">
                          {dagKort[idx]} {d.getDate()} S2
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {Object.entries(perMedewerker).map(([, regels]) => {
                    const naam = regels[0].naam;

                    return (
                      <tr key={regels[0].medewerker_id} className="hover:bg-slate-50">
                        <td
                          className="sticky left-0 z-10 max-w-[190px] bg-white px-4 py-3 font-semibold text-slate-950"
                          title={naam}
                        >
                          <div className="truncate">{naam}</div>
                          {regels[0].opmerkingen && (
                            <div className="mt-1 truncate text-xs font-normal text-slate-500">
                              {regels[0].opmerkingen}
                            </div>
                          )}
                        </td>

                        {weekDates.map((d) => {
                          const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;

                          const aktRegel = [...regels].reverse().find((r) => {
                            const rs = new Date(r.startdatum);
                            const re = new Date(r.einddatum);
                            return rs <= d && re >= d;
                          });

                          const a1 = aktRegel
                            ? aktRegel[`${dagen[dayIdx]}_1`]
                            : false;
                          const a2 = aktRegel
                            ? aktRegel[`${dagen[dayIdx]}_2`]
                            : false;

                          return (
                            <React.Fragment key={d.toISOString()}>
                              <td className="px-2 py-3 text-center">
                                {a1 ? (
                                  <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-600" />
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>

                              <td className="px-2 py-3 text-center">
                                {a2 ? (
                                  <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-600" />
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}