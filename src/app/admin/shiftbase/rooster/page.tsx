"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type ShiftItem = {
  id: string;
  Roster: {
    starttime: string;
    endtime: string;
    name: string;
    color?: string;
    user_id: string | number;
  };
  Shift?: { long_name: string };
  User?: { id: string | number; name: string };
};

type WageByAgeRow = { date: string; user_id: string | number; wage: number };
type WageByAgeResp = { data?: WageByAgeRow[] } | null;

function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(iso: string, offset: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + offset);
  return ymdLocal(d);
}
function startOfISOWeekMonday(d: Date) {
  const tmp = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (tmp.getDay() + 6) % 7; // Ma=0..Zo=6
  tmp.setDate(tmp.getDate() - day);
  return tmp;
}
function firstName(full?: string) {
  if (!full) return "Onbekend";
  const w = full.trim().split(/\s+/)[0];
  return w.split("-")[0] || w;
}
function hoursBetween(startHHMMSS: string, endHHMMSS: string) {
  const [sh, sm] = startHHMMSS.split(":").map(Number);
  const [eh, em] = endHHMMSS.split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;
  return minutes / 60;
}
const EUR = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

const GEWENSTE_VOLGORDE = [
  "S1K", "S1KV", "S1", "S1Z", "S1L", "S1S",
  "S2K", "S2", "S2L", "S2S",
  "SPS", "SLW1", "SLW2",
];

export default function RoosterPage() {
  const today = ymdLocal(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [view, setView] = useState<"day" | "week">("day");

  // ---- DAG ----
  const { data: dayRooster, error: dayError } = useSWR<ShiftItem[]>(
    view === "day" ? `/api/shiftbase/rooster?datum=${selectedDate}` : null,
    fetcher
  );

  const { perShiftDay, orderDay } = useMemo(() => {
    const acc: Record<string, ShiftItem[]> = {};
    (dayRooster ?? []).forEach((it) => (acc[it.Roster.name] ||= []).push(it));
    Object.values(acc).forEach((arr) =>
      arr.sort((a, b) => a.Roster.starttime.localeCompare(b.Roster.starttime))
    );
    const present = Object.keys(acc);
    const pref = GEWENSTE_VOLGORDE.filter((n) => n in acc);
    const rest = present.filter((n) => !GEWENSTE_VOLGORDE.includes(n));
    return { perShiftDay: acc, orderDay: pref.concat(rest) };
  }, [dayRooster]);

  // ---- WEEK ----
  const weekDates = useMemo(() => {
    const start = startOfISOWeekMonday(new Date(selectedDate + "T12:00:00"));
    return Array.from({ length: 7 }, (_, i) =>
      ymdLocal(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
    );
  }, [selectedDate]);

  const { data: weekRooster } = useSWR<Record<string, ShiftItem[]>>(
    view === "week" ? (["week-rooster", weekDates] as const) : null,
    async (key) => {
      const [, dates] = key as readonly [string, string[]];
      if (!Array.isArray(dates) || dates.length === 0) return {};
      const res = await Promise.all(
        dates.map((d) =>
          fetch(`/api/shiftbase/rooster?datum=${d}`).then((r) => r.json())
        )
      );
      const out: Record<string, ShiftItem[]> = {};
      dates.forEach((d, i) => (out[d] = Array.isArray(res[i]) ? res[i] : []));
      return out;
    }
  );

  // Unieke user_ids van het weekrooster → meegeven aan wages‑by‑age
  const weekUserIds = useMemo(() => {
    const s = new Set<string>();
    if (weekRooster) {
      Object.values(weekRooster).forEach((items) => {
        (items ?? []).forEach((it) => s.add(String(it.Roster.user_id)));
      });
    }
    return Array.from(s);
  }, [weekRooster]);

  const wagesUrl =
    view === "week" && weekRooster
      ? `/api/shiftbase/wages-by-age?min_date=${weekDates[0]}&max_date=${weekDates[6]}&user_ids=${encodeURIComponent(
          weekUserIds.join(",")
        )}`
      : null;

  const { data: wagesByAge, error: wagesError } = useSWR<WageByAgeResp>(
    wagesUrl,
    fetcher
  );

  const wageByDateUser = useMemo(() => {
    const out = new Map<string, Map<string, number>>();
    for (const row of wagesByAge?.data ?? []) {
      const date = row.date;
      const uid = String(row.user_id);
      if (!out.has(date)) out.set(date, new Map());
      out.get(date)!.set(uid, row.wage);
    }
    return out;
  }, [wagesByAge]);

  // ---- Navigatie ----
  const changeDay = (offset: number) =>
    setSelectedDate((prev) => addDays(prev, view === "day" ? offset : offset * 7));
  const goToday = () => setSelectedDate(today);

  return (
    <div className="p-4">
      {/* Nav */}
      <div className="flex flex-wrap items-center mb-4 gap-2">
        <button onClick={() => changeDay(-1)} className="px-2 py-1 bg-gray-200 rounded">←</button>
        <input type="date" min="2024-01-01" max="2026-12-31" value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border px-2 py-1 rounded" />
        <button onClick={() => changeDay(1)} className="px-2 py-1 bg-gray-200 rounded">→</button>
        <button onClick={goToday} className="ml-2 px-2 py-1 rounded border border-gray-300 hover:bg-gray-100">Vandaag</button>
        <div className="ml-auto flex gap-1">
          <button onClick={() => setView("day")}
            className={`px-3 py-1 rounded border ${view === "day" ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-100"}`}>
            Dag
          </button>
          <button onClick={() => setView("week")}
            className={`px-3 py-1 rounded border ${view === "week" ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-100"}`}>
            Week
          </button>
        </div>
      </div>

      {/* Titel */}
      {view === "day" ? (
        <h1 className="text-xl font-bold mb-2">
          Rooster voor{" "}
          {new Date(selectedDate + "T12:00:00").toLocaleDateString("nl-NL", {
            weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
          })}
        </h1>
      ) : (
        <h1 className="text-xl font-bold mb-2">
          Rooster week{" "}
          {new Date(weekDates[0] + "T12:00:00").toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit" })}{" "}
          –{" "}
          {new Date(weekDates[6] + "T12:00:00").toLocaleDateString("nl-NL", {
            day: "2-digit", month: "2-digit", year: "numeric",
          })}
        </h1>
      )}

      {/* Dag */}
      {view === "day" ? (
        <>
          {dayError && <p className="p-4 text-red-600">Fout bij laden rooster: {String(dayError?.message ?? dayError)}</p>}
          {dayRooster == null ? (
            <p className="p-4">Laden…</p>
          ) : orderDay.length === 0 ? (
            <p>Geen shifts gevonden voor deze dag.</p>
          ) : (
            orderDay.map((shiftName) => {
              const groep = perShiftDay[shiftName];
              const headerColor = groep?.[0]?.Roster?.color || "#334";
              const headerText = groep?.[0]?.Shift?.long_name || shiftName;
              return (
                <section key={shiftName} className="mb-6">
                  <h2 className="text-lg font-semibold mb-1 px-2 py-1 rounded text-white" style={{ backgroundColor: headerColor }}>
                    {headerText}
                  </h2>
                  <ul className="pl-4 list-disc">
                    {groep.map((item) => (
                      <li key={item.id} className="mb-1">
                        <span className="font-semibold">
                          {item.Roster.starttime.slice(0,5)}–{item.Roster.endtime.slice(0,5)}
                        </span>{" "}
                        <strong>{item.User?.name || "Onbekend"}</strong>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </>
      ) : (
        // Week
        <>
          {wagesError && <p className="p-4 text-red-600">Fout lonen (leeftijd): {String(wagesError?.message ?? wagesError)}</p>}
          {!weekRooster ? (
            <p className="p-4">Laden…</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
              {weekDates.map((d) => {
                const roster = weekRooster[d] || [];

                // per shift groeperen
                const perShift: Record<string, ShiftItem[]> = {};
                for (const item of roster) (perShift[item.Roster.name] ||= []).push(item);
                for (const k of Object.keys(perShift)) {
                  perShift[k].sort((a, b) => a.Roster.starttime.localeCompare(b.Roster.starttime));
                }
                const order = [
                  ...GEWENSTE_VOLGORDE.filter((n) => n in perShift),
                  ...Object.keys(perShift).filter((n) => !GEWENSTE_VOLGORDE.includes(n)),
                ];

                // kosten berekenen
                const wageMap = wageByDateUser.get(d);
                let dayCost = 0;
                let planned = 0;
                let withWage = 0;

                for (const items of Object.values(perShift)) {
                  for (const it of items) {
                    planned += 1;
                    const uid = String(it.Roster.user_id);
                    const wage = wageMap?.get(uid) ?? 0;
                    const hours = hoursBetween(it.Roster.starttime, it.Roster.endtime);
                    if (wage > 0 && hours > 0) {
                      withWage += 1;
                      dayCost += hours * wage;
                    }
                  }
                }

                return (
                  <div key={d} className="border rounded-lg p-2 text-xs leading-tight">
                    <div className="flex items-baseline justify-between mb-2">
                      <h3 className="font-semibold">
                        {new Date(d + "T12:00:00").toLocaleDateString("nl-NL", {
                          weekday: "short", day: "2-digit", month: "2-digit",
                        })}
                      </h3>
                      {d === today && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">vandaag</span>}
                    </div>

                    {order.length === 0 ? (
                      <p className="text-[11px] text-gray-500">Geen shifts.</p>
                    ) : (
                      order.map((shiftName) => {
                        const groep = perShift[shiftName];
                        const headerColor = groep?.[0]?.Roster?.color || "#334";
                        const headerText = groep?.[0]?.Shift?.long_name || shiftName;
                        return (
                          <div key={shiftName} className="mb-2">
                            <div className="text-[11px] font-semibold mb-1 px-2 py-0.5 rounded text-white"
                              style={{ backgroundColor: headerColor }}>
                              {headerText}
                            </div>
                            <ul className="pl-0 list-none space-y-0.5">
                              {groep.map((item) => (
                                <li key={item.id} className="px-1 py-0.5 rounded bg-gray-50">
                                  <strong>{firstName(item.User?.name)}</strong>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })
                    )}

                    <div className="mt-2 pt-2 border-t flex items-center justify-between text-[11px]">
                      <span>Personeelskosten <span className="opacity-60">({withWage}/{planned} met tarief)</span></span>
                      <strong>{dayCost > 0 ? EUR.format(dayCost) : "—"}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
