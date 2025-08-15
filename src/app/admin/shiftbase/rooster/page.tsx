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
    starttime: string;
    endtime: string;
    name: string;
    color?: string;
    user_id: string;
  };
  Shift?: { long_name: string };
  User?: { id: string; name: string };
};

type TimesheetRow = {
  Timesheet: {
    user_id: string;
    date: string;
    clocked_in: string | null;
    clocked_out: string | null;
    total?: string | null;
    status?: string | null;
  };
};
type TimesheetResp = { data?: TimesheetRow[] } | null;

type ContractRow = {
  Contract: {
    id: string;
    user_id: string;
    startdate: string;
    enddate: string | null;
    wage?: string; // vaak "12.50" (maar bij jou nu "0.00")
  };
};
type ContractsResp = { data?: ContractRow[] } | null;

type WageRow = { user_id: string; wage: number };
type WagesResp = { data?: WageRow[] } | null;

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
  if (minutes < 0) minutes += 24 * 60;
  return minutes / 60;
}
const EUR = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

const GEWENSTE_VOLGORDE = [
  "S1K", "S1KV", "S1", "S1Z", "S1L", "S1S",
  "S2K", "S2", "S2L", "S2S",
  "SPS", "SLW1", "SLW2",
];

// ✅ Snelle handmatige fallback (vul desnoods even in tot DB/Contracts lonen leveren)
const MANUAL_WAGE: Record<string, number> = {
  // "625996": 13.50,
};

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
      if (r?.Timesheet?.date === selectedDate) map.set(r.Timesheet.user_id, r.Timesheet);
    }
    return map;
  }, [dayTimesheets, selectedDate]);

  const perShiftDay = useMemo(() => {
    if (!dayRooster) return {} as Record<string, ShiftItem[]>;
    const acc: Record<string, ShiftItem[]> = {};
    for (const item of dayRooster) (acc[item.Roster.name] ||= []).push(item);
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

  // (optioneel) timesheets week — we tonen geen badges in weekview nu
  useSWR<TimesheetResp>(
    view === "week"
      ? `/api/shiftbase/timesheets?min_date=${weekDates[0]}&max_date=${weekDates[6]}`
      : null,
    fetcher
  );

  // ----- WAGES: DB → Contracts → Manual ----------------------
  // 1) uit je eigen DB (aan te bieden via route hieronder)
  const { data: wagesDb } = useSWR<WagesResp>("/api/shiftbase/wages", fetcher);

  // 2) uit Shiftbase contracts (kan 0.00 zijn; we proberen parser)
  const { data: contractsResp } = useSWR<ContractsResp>("/api/shiftbase/contracts", fetcher);

  const wageByUser = useMemo(() => {
    const map = new Map<string, number>();

    // DB‑wages eerst
    for (const r of wagesDb?.data ?? []) {
      if (r && r.user_id && isFinite(r.wage) && r.wage > 0) map.set(r.user_id, r.wage);
    }

    // Contracts daarna (alleen als DB niets heeft voor die user)
    const rows = contractsResp?.data ?? [];
    const getWage = (c: any): number => {
      const candidates = [c?.wage, c?.hourly_wage, c?.hour_rate, c?.hour, c?.rate];
      for (const v of candidates) {
        if (v == null) continue;
        const num =
          typeof v === "string" ? parseFloat(v.replace(",", ".")) :
          typeof v === "number" ? v : 0;
        if (isFinite(num) && num > 0) return num;
      }
      return 0;
    };
    const best: Record<string, { start: string; wage: number }> = {};
    for (const r of rows) {
      const c = (r as any)?.Contract ?? (r as any)?.contract ?? r;
      if (!c?.user_id) continue;
      const wage = getWage(c);
      if (!wage) continue;
      const cur = best[c.user_id];
      if (!cur || (c.startdate && c.startdate > cur.start)) {
        best[c.user_id] = { start: c.startdate || "0000-00-00", wage };
      }
    }
    Object.entries(best).forEach(([uid, v]) => {
      if (!map.has(uid)) map.set(uid, v.wage);
    });

    // 3) Manual fallback (alleen als er nog niets is)
    Object.entries(MANUAL_WAGE).forEach(([uid, wage]) => {
      if (!map.has(uid) && wage > 0) map.set(uid, wage);
    });

    return map;
  }, [wagesDb, contractsResp]);

  // ----- Navigatie -------------------------------------------
  const changeDay = (offset: number) => {
    setSelectedDate((prev) => addDays(prev, view === "day" ? offset : offset * 7));
  };
  const goToday = () => setSelectedDate(today);

  // ----- Render ----------------------------------------------
  return (
    <div className="p-4">
      {/* Navigatie + toggle */}
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

      {/* TITEL */}
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

      {/* INHOUD */}
      {view === "day" ? (
        <>
          {dayError && <p className="p-4 text-red-600">Fout bij laden rooster: {String(dayError?.message ?? dayError)}</p>}
          {!dayRooster ? (
            <p className="p-4">Laden…</p>
          ) : Object.keys(perShiftDay).length === 0 ? (
            <p>Geen shifts gevonden voor deze dag.</p>
          ) : (
            Object.keys(perShiftDay).map((shiftName) => {
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
                          {/* Dagview: timesheet-badge kun je aan laten */}
                          {/* (We laten hem hier staan zoals eerder) */}
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
          {wageByUser.size === 0 && (
            <div className="mb-2 text-xs px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded">
              Geen uurlonen gevonden in DB/Contracts. Vul tijdelijk MANUAL_WAGE in of voeg lonen toe via /api/shiftbase/wages.
            </div>
          )}
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

                // Personeelskosten (gepland) — DB/Contracts/Manual lonen
                let dayCost = 0;
                for (const items of Object.values(perShift)) {
                  for (const it of items) {
                    const hours = hoursBetween(it.Roster.starttime, it.Roster.endtime);
                    const wage =
                      wageByUser.get(it.Roster.user_id)
                      ?? 0;
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
