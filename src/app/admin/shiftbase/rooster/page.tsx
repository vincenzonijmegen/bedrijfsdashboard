// ===========================
// File: src/app/admin/shiftbase/rooster/page.tsx
// ===========================
"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// --- Types ----------------------------------------------------
type ShiftItem = {
  id: string;
  Roster: {
    starttime: string; // "HH:MM:SS"
    endtime: string;   // "HH:MM:SS"
    name: string;      // short code (bv. "S1K")
    color?: string;
    user_id: string;
  };
  Shift?: { long_name: string };
  User?: { id: string; name: string };
};

type TimesheetRow = {
  Timesheet: {
    user_id: string;
    date: string;                // "YYYY-MM-DD"
    clocked_in: string | null;   // ISO of "YYYY-MM-DDTHH:MM:SS"
    clocked_out: string | null;  // idem
    total?: string | null;
    status?: string | null;
  };
};

type TimesheetResp = { data?: TimesheetRow[] } | null;

// --- Utils ----------------------------------------------------
function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hhmm(s?: string | null) {
  if (!s) return "--";
  const t = s.includes("T") ? s.split("T")[1] : s;
  return t.slice(0, 5);
}

function classByTimesheet(entry?: TimesheetRow["Timesheet"]) {
  if (!entry) return "bg-red-100 text-red-800";
  const { clocked_in, clocked_out } = entry;
  if (clocked_in && clocked_out) return "bg-green-100 text-green-800";
  if (clocked_in || clocked_out) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

function startOfISOWeekMonday(d: Date) {
  const tmp = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (tmp.getDay() + 6) % 7; // Ma=0..Zo=6
  tmp.setDate(tmp.getDate() - day);
  return tmp;
}

function addDays(iso: string, offset: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + offset);
  return ymdLocal(d);
}

const GEWENSTE_VOLGORDE = [
  "S1K", "S1KV", "S1", "S1Z", "S1L", "S1S",
  "S2K", "S2", "S2L", "S2S",
  "SPS", "SLW1", "SLW2",
];

// -------------------------------------------------------------
export default function RoosterPage() {
  const today = useMemo(() => ymdLocal(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [view, setView] = useState<"day" | "week">("day");

  useEffect(() => {
    console.log("[DEBUG] selectedDate:", selectedDate, "view:", view);
  }, [selectedDate, view]);

  // ----- DAG DATA --------------------------------------------
  const { data: dayRooster, error: dayError } = useSWR<ShiftItem[]>(
    view === "day" ? `/api/shiftbase/rooster?datum=${selectedDate}` : null,
    fetcher
  );

  const { data: dayTimesheets } = useSWR<TimesheetResp>(
    view === "day"
      ? `/api/shiftbase/timesheets?min_date=${selectedDate}&max_date=${selectedDate}`
      : null,
    fetcher
  );

  const tsByUserDay = useMemo(() => {
    const map = new Map<string, TimesheetRow["Timesheet"]>();
    const rows = dayTimesheets?.data ?? [];
    for (const r of rows) {
      if (r?.Timesheet?.date === selectedDate) {
        map.set(r.Timesheet.user_id, r.Timesheet);
      }
    }
    return map;
  }, [dayTimesheets, selectedDate]);

  const perShiftDay = useMemo(() => {
    if (!dayRooster) return {} as Record<string, ShiftItem[]>;
    const acc: Record<string, ShiftItem[]> = {};
    for (const item of dayRooster) {
      (acc[item.Roster.name] ||= []).push(item);
    }
    for (const key of Object.keys(acc)) {
      acc[key].sort((a, b) => a.Roster.starttime.localeCompare(b.Roster.starttime));
    }
    return acc;
  }, [dayRooster]);

  const orderDay = useMemo(() => {
    const present = Object.keys(perShiftDay);
    const pref = GEWENSTE_VOLGORDE.filter((n) => n in perShiftDay);
    const rest = present.filter((n) => !GEWENSTE_VOLGORDE.includes(n));
    return pref.concat(rest);
  }, [perShiftDay]);

  // ----- WEEK DATA -------------------------------------------
  const weekDates = useMemo(() => {
    const start = startOfISOWeekMonday(new Date(selectedDate + "T12:00:00"));
    return Array.from({ length: 7 }, (_, i) =>
      ymdLocal(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
    );
  }, [selectedDate]);

  // Belangrijk: gebruik 1 fetcher-argument (de tuple-key) en haal dates eruit
  const { data: weekRooster, error: weekError } = useSWR<Record<string, ShiftItem[]>>(
    view === "week" ? (["week-rooster", weekDates] as const) : null,
    async (key) => {
      const [, dates] = key as readonly [string, string[]];
      if (!Array.isArray(dates) || dates.length === 0) return {};
      const res = await Promise.all(
        dates.map((d) =>
          fetch(`/api/shiftbase/rooster?datum=${d}`).then((r) => {
            if (!r.ok) throw new Error(`Rooster ${d} status ${r.status}`);
            return r.json();
          })
        )
      );
      const dict: Record<string, ShiftItem[]> = {};
      dates.forEach((d, i) => (dict[d] = Array.isArray(res[i]) ? res[i] : []));
      return dict;
    }
  );

  const { data: weekTimesheets } = useSWR<TimesheetResp>(
    view === "week"
      ? `/api/shiftbase/timesheets?min_date=${weekDates[0]}&max_date=${weekDates[6]}`
      : null,
    fetcher
  );

  const tsByDateUser = useMemo(() => {
    const outer = new Map<string, Map<string, TimesheetRow["Timesheet"]>>();
    const rows = weekTimesheets?.data ?? [];
    for (const r of rows) {
      const d = r?.Timesheet?.date;
      const u = r?.Timesheet?.user_id;
      if (!d || !u) continue;
      if (!outer.has(d)) outer.set(d, new Map());
      outer.get(d)!.set(u, r.Timesheet);
    }
    return outer;
  }, [weekTimesheets]);

  // ----- Navigatie -------------------------------------------
  const changeDay = (offset: number) => {
    setSelectedDate((prev) => addDays(prev, view === "day" ? offset : offset * 7));
  };
  const goToday = () => setSelectedDate(today);

  // ----- Render helpers --------------------------------------
  const renderTimesheetBadge = (ts?: TimesheetRow["Timesheet"]) => {
    const cls = classByTimesheet(ts);
    return (
      <div className={`flex items-center gap-2 text-sm ${cls} px-2 py-0.5 rounded`}>
        <span aria-hidden>⏱</span>
        <span>In: {hhmm(ts?.clocked_in)}</span>
        <span>Uit: {hhmm(ts?.clocked_out)}</span>
      </div>
    );
  };

  // ----- Render ----------------------------------------------
  return (
    <div className="p-4">
      {/* Navigatie + toggle */}
      <div className="flex flex-wrap items-center mb-4 gap-2">
        <button onClick={() => changeDay(-1)} className="px-2 py-1 bg-gray-200 rounded">
          ←
        </button>
        <input
          type="date"
          min="2024-01-01"
          max="2026-12-31"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border px-2 py-1 rounded"
        />
        <button onClick={() => changeDay(1)} className="px-2 py-1 bg-gray-200 rounded">
          →
        </button>
        <button onClick={goToday} className="ml-2 px-2 py-1 rounded border border-gray-300 hover:bg-gray-100">
          Vandaag
        </button>
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => setView("day")}
            className={`px-3 py-1 rounded border ${view === "day" ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-100"}`}
            aria-pressed={view === "day"}
          >
            Dag
          </button>
          <button
            onClick={() => setView("week")}
            className={`px-3 py-1 rounded border ${view === "week" ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-100"}`}
            aria-pressed={view === "week"}
          >
            Week
          </button>
        </div>
      </div>

      {/* TITEL */}
      {view === "day" ? (
        <h1 className="text-xl font-bold mb-2">
          Rooster voor{" "}
          {new Date(selectedDate + "T12:00:00").toLocaleDateString("nl-NL", {
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </h1>
      ) : (
        <h1 className="text-xl font-bold mb-2">
          Rooster week{" "}
          {new Date(weekDates[0] + "T12:00:00").toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit" })}{" "}
          –{" "}
          {new Date(weekDates[6] + "T12:00:00").toLocaleDateString("nl-NL", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </h1>
      )}

      {/* INHOUD */}
      {view === "day" ? (
        <>
          {dayError && <p className="p-4 text-red-600">Fout bij laden rooster: {String(dayError?.message ?? dayError)}</p>}
          {!dayRooster ? (
            <p className="p-4">Laden…</p>
          ) : orderDay.length === 0 ? (
            <p>Geen shifts gevonden voor deze dag.</p>
          ) : (
            orderDay.map((shiftName) => {
              const groep = perShiftDay[shiftName];
              const headerColor = groep?.[0]?.Roster?.color || "#334";
              const headerText = groep?.[0]?.Shift?.long_name || shiftName;
              return (
                <div key={shiftName} className="mb-6">
                  <h2 className="text-lg font-semibold mb-1 px-2 rounded" style={{ backgroundColor: headerColor, color: "white" }}>
                    {headerText}
                  </h2>
                  <ul className="pl-4 list-disc">
                    {groep.map((item) => {
                      const ts = tsByUserDay.get(item.Roster.user_id);
                      return (
                        <li key={item.id} className="mb-1 flex flex-wrap gap-2">
                          <span className="mr-2">
                            <span className="font-semibold">
                              {item.Roster.starttime.slice(0, 5)}–{item.Roster.endtime.slice(0, 5)}
                            </span>{" "}
                            <strong>{item.User?.name || "Onbekend"}</strong>
                          </span>
                          {renderTimesheetBadge(ts)}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </>
      ) : (
        <>
          {weekError && <p className="p-4 text-red-600">Fout weekrooster: {String(weekError?.message ?? weekError)}</p>}
          {!weekRooster ? (
            <p className="p-4">Laden…</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
              {weekDates.map((d) => {
                const roster = weekRooster[d] || [];
                // groepeer per shift & sorteer
                const perShift: Record<string, ShiftItem[]> = {};
                for (const item of roster) (perShift[item.Roster.name] ||= []).push(item);
                for (const k of Object.keys(perShift)) {
                  perShift[k].sort((a, b) => a.Roster.starttime.localeCompare(b.Roster.starttime));
                }
                const order = [
                  ...GEWENSTE_VOLGORDE.filter((n) => n in perShift),
                  ...Object.keys(perShift).filter((n) => !GEWENSTE_VOLGORDE.includes(n)),
                ];
                const tsMapForDay = tsByDateUser.get(d);

                return (
                  <div key={d} className="border rounded-lg p-3">
                    <div className="flex items-baseline justify-between mb-2">
                      <h3 className="font-semibold">
                        {new Date(d + "T12:00:00").toLocaleDateString("nl-NL", {
                          weekday: "short",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </h3>
                      {d === today && <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">vandaag</span>}
                    </div>

                    {order.length === 0 ? (
                      <p className="text-sm text-gray-500">Geen shifts voor deze dag.</p>
                    ) : (
                      order.map((shiftName) => {
                        const groep = perShift[shiftName];
                        const headerColor = groep?.[0]?.Roster?.color || "#334";
                        const headerText = groep?.[0]?.Shift?.long_name || shiftName;

                        return (
                          <div key={shiftName} className="mb-4">
                            <div className="text-sm font-semibold mb-1 px-2 rounded" style={{ backgroundColor: headerColor, color: "white" }}>
                              {headerText}
                            </div>
                            <ul className="pl-4 list-disc">
                              {groep.map((item) => {
                                const ts = tsMapForDay?.get(item.Roster.user_id);
                                return (
                                  <li key={item.id} className="mb-1 flex flex-wrap gap-2">
                                    <span className="mr-2">
                                      <span className="font-semibold">
                                        {item.Roster.starttime.slice(0, 5)}–{item.Roster.endtime.slice(0, 5)}
                                      </span>{" "}
                                      <strong>{item.User?.name || "Onbekend"}</strong>
                                    </span>
                                    {renderTimesheetBadge(ts)}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })
                    )}
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
