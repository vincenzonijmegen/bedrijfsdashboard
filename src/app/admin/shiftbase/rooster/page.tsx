// ===========================
// File: src/app/admin/shiftbase/rooster/page.tsx
// ===========================
"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// --- Types ----------------------------------------------------
type ShiftItem = {
  id: string;
  Roster: {
    starttime: string; // "HH:MM:SS"
    endtime: string;   // "HH:MM:SS"
    name: string;      // bijv. "S1K"
    color?: string;
    user_id: string;
  };
  Shift?: { long_name: string };
  User?: { id: string; name: string };
};

type WageByAgeRow = { date: string; user_id: string; wage: number };
type WageByAgeResp = { data?: WageByAgeRow[] } | null;

// --- Utils ----------------------------------------------------
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
  if (minutes < 0) minutes += 24 * 60; // shift over middernacht
  return minutes / 60;
}
const EUR = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

const GEWENSTE_VOLGORDE = [
  "S1K", "S1KV", "S1", "S1Z", "S1L", "S1S",
  "S2K", "S2", "S2L", "S2S",
  "SPS", "SLW1", "SLW2",
];

// -------------------------------------------------------------
export default function RoosterPage() {
  const today = ymdLocal(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [view, setView] = useState<"day" | "week">("day");

  // ----- DAG ROOSTER -----------------------------------------
  const { data: dayRooster, error: dayError } = useSWR<ShiftItem[]>(
    view === "day" ? `/api/shiftbase/rooster?datum=${selectedDate}` : null,
    fetcher
  );

  // ----- WEEK -------------------------------------------------
  const weekDates = useMemo(() => {
    const start = startOfISOWeekMonday(new Date(selectedDate + "T12:00:00"));
    return Array.from({ length: 7 }, (_, i) =>
      ymdLocal(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
    );
  }, [selectedDate]);

  // Roosters voor alle weekdagen
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

  // 🔑 Uurlonen op basis van leeftijd per dag (alleen weekbereik)
  const { data: wagesByAge, error: wagesError } = useSWR<WageByAgeResp>(
    view === "week"
      ? `/api/shiftbase/wages-by-age?min_date=${weekDates[0]}&max_date=${weekDates[6]}`
      : null,
    fetcher
  );

  // Map: date -> (user_id -> wage)
  const wageByDateUser = useMemo(() => {
    const outer = new Map<string, Map<string, number>>();
    for (const row of wagesByAge?.data ?? []) {
      if (!outer.has(row.date)) outer.set(row.date, new Map());
      outer.get(row.date)!.set(row.user_id, row.wage);
    }
    return outer;
  }, [wagesByAge]);

  // ----- Navigatie -------------------------------------------
  const changeDay = (offset: number) => {
    setSelectedDate((prev) => addDays(prev, view === "day" ? offset : offset * 7));
  };
  const goToday = () => setSelectedDate(today);

  // ----- Render ----------------------------------------------
  return (
    <div className="p-4">
      {/* Nav + toggle */}
      <div className="flex flex-wrap items-center mb-4 gap-2">
        <button onClick={() => changeDay(-1)} className="px-2 py-1 bg-gray-200 rounded">←</button>
        <input
          type="date"
          min="2024-01-01"
          max="2026-12-31"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border px-2 py-1 rounded"
        />
        <button onClick={() => changeDay(1)} className="px-2 py-1 bg-gray-200 rounded">→</button>
        <button onClick={goToday} className="ml-2 px-2 py-1 rounded border border-gray-300 hover:bg-gray-100">Vandaag</button>
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

      {/* Dag-inhoud (alleen rooster, clean) */}
      {view === "day" ? (
        <>
          {dayError && <p className="p-4 text-red-600">Fout bij laden rooster: {String(dayError?.message ?? dayError)}</p>}
          {!dayRooster ? (
            <p className="p-4">Laden…</p>
          ) : dayRooster.length === 0 ? (
            <p>Geen shifts gevonden voor deze dag.</p>
          ) : (
            // Eenvoudige lijst (met tijden + volledige naam is oké in dagview)
            <ul className="pl-4 list-disc">
              {dayRooster
                .slice()
                .sort((a, b) => a.Roster.starttime.localeCompare(b.Roster.starttime))
                .map((item) => (
                  <li key={item.id} className="mb-1">
                    <span className="font-semibold">
                      {item.Roster.starttime.slice(0,5)}–{item.Roster.endtime.slice(0,5)}
                    </span>{" "}
                    <strong>{item.User?.name || "Onbekend"}</strong>{" "}
                    <span className="opacity-70">({item.Shift?.long_name || item.Roster.name})</span>
                  </li>
                ))}
            </ul>
          )}
        </>
      ) : (
        // Weekview
        <>
          {weekError && <p className="p-4 text-red-600">Fout weekrooster: {String(weekError?.message ?? weekError)}</p>}
          {wagesError && <p className="p-4 text-red-600">Fout bij lonen op leeftijd: {String(wagesError?.message ?? wagesError)}</p>}
          {!weekRooster ? (
            <p className="p-4">Laden…</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
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

                // Kosten: som( uren × uurloonOpDieDag(user) )
                const wageMap = wageByDateUser.get(d);
                let dayCost = 0;
                for (const items of Object.values(perShift)) {
                  for (const it of items) {
                    const hours = hoursBetween(it.Roster.starttime, it.Roster.endtime);
                    const wage = wageMap?.get(it.Roster.user_id) ?? 0;
                    if (wage > 0 && hours > 0) dayCost += hours * wage;
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
                      {d === today && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                          vandaag
                        </span>
                      )}
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
                            <div
                              className="text-[11px] font-semibold mb-1 px-2 py-0.5 rounded"
                              style={{ backgroundColor: headerColor, color: "white" }}
                            >
                              {headerText}
                            </div>
                            {/* Alleen voornaam, geen tijden */}
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
                      <span>Personeelskosten</span>
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
