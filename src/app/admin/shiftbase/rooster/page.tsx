// ===========================
// File: src/app/admin/shiftbase/rooster/page.tsx
// ===========================
"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Eye, EyeOff } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type ShiftItem = {
  id: string;
  Roster: {
    id?: string | number;
    starttime: string;
    endtime: string;
    name: string;
    color?: string;
    user_id: string | number;
  };
  Shift?: { long_name: string };
  User?: { id: string | number; name: string };
};

type ClockRow = {
  Timesheet: {
    user_id: string | number;
    roster_id?: string | number;
    date?: string;
    clocked_in?: string | null;
    clocked_out?: string | null;
    status?: string | null;
  };
  Roster?: { id?: string | number; starttime?: string; endtime?: string };
};

type TimesheetRow = {
  Timesheet: {
    user_id: string | number;
    roster_id?: string | number;
    date?: string;
    clocked_in?: string | null;
    clocked_out?: string | null;
    status?: string | null;
    total?: string | number;
  };
};

// Leeftijdsloon + factor/opslag
type WageByAgeRow = {
  date: string;
  user_id: string | number;
  wage: number;
  factor?: number;
  opslag?: number;
};
type WageByAgeResp = { data?: WageByAgeRow[] } | null;

function ymdLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function addDays(iso: string, offset: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + offset);
  return ymdLocal(d);
}
function startOfISOWeekMonday(d: Date) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (t.getDay() + 6) % 7; // 0 = ma
  t.setDate(t.getDate() - day);
  return t;
}
function firstName(full?: string) {
  if (!full) return "Onbekend";
  const w = full.trim().split(/\s+/)[0];
  return w.split("-")[0] || w;
}
function hoursBetween(a: string, b: string) {
  const [sh, sm] = a.split(":").map(Number);
  const [eh, em] = b.split(":").map(Number);
  let m = eh * 60 + em - (sh * 60 + sm);
  if (m < 0) m += 1440;
  return m / 60;
}
const maskDigits = (s: string) => s.replace(/[\d.,]/g, "•"); // sterk mask: cijfers, punten, komma's

const EUR0 = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const GEWENSTE = ["S1K","S1KV","S1","S1Z","S1L","S1S","S2K","S2","S2L","S2S","SPS","SLW1","SLW2"];
const keyDU = (date: string, userId: string | number) => `${date}:${String(userId)}`;
const DEFAULT_FACTOR = 1;
function getEffectiveFactor(row?: { factor?: number; opslag?: number }) {
  if (!row) return DEFAULT_FACTOR;
  if (typeof row.factor === "number" && isFinite(row.factor) && row.factor > 0) return row.factor;
  if (typeof row.opslag === "number" && isFinite(row.opslag)) return 1 + row.opslag;
  return DEFAULT_FACTOR;
}

export default function RoosterPage() {
  const today = ymdLocal(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState<"day" | "week">("day");

  // Exclude-knoppen voor weekview (in-/uitvinken medewerkers)
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const toggleExcluded = (date: string, userId: string | number) => {
    setExcluded((prev) => {
      const n = new Set(prev);
      const k = keyDU(date, userId);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  };
  const clearExcludedForDay = (date: string) => {
    setExcluded((prev) => {
      const n = new Set<string>();
      for (const k of prev) if (!k.startsWith(date + ":")) n.add(k);
      return n;
    });
  };

  // ==== MASK bedragen (zoals omzet) ====
  const [mask, setMask] = useState(false);
  useEffect(() => {
    try {
      const v =
        localStorage.getItem("mask-bedragen") ??
        localStorage.getItem("mask-omzet") ??
        localStorage.getItem("maskOmzet");
      setMask(v === "1" || v === "true");
    } catch {}
  }, []);
  const toggleMask = () => {
    setMask((prev) => {
      const nv = !prev;
      try {
        localStorage.setItem("mask-bedragen", nv ? "1" : "0");
        localStorage.setItem("mask-omzet", nv ? "1" : "0");
      } catch {}
      return nv;
    });
  };

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
    return {
      perShiftDay: acc,
      orderDay: [
        ...GEWENSTE.filter((n) => n in acc),
        ...present.filter((n) => !GEWENSTE.includes(n)),
      ],
    };
  }, [dayRooster]);

  // Alleen vandaag klok/timesheets tonen
  const loadToday = view === "day" && selectedDate === today;

  const { data: clocksResp } = useSWR<{ data?: ClockRow[] }>(
    loadToday ? `/api/shiftbase/clock?date=${selectedDate}` : null,
    fetcher
  );
  const { data: timesheetsResp } = useSWR<{ data?: TimesheetRow[] }>(
    loadToday ? `/api/shiftbase/timesheets?date=${selectedDate}` : null,
    fetcher
  );

  // CLOCK beste timesheet per roster & per user
  const clockBy = useMemo(() => {
    const score = (t?: ClockRow["Timesheet"]) =>
      (t?.clocked_in ? 1 : 0) + (t?.clocked_out ? 1 : 0);

    const byRoster = new Map<string, ClockRow["Timesheet"]>();
    const byUser = new Map<string, ClockRow["Timesheet"]>();

    for (const row of (clocksResp?.data ?? [])) {
      const ts = row.Timesheet;
      const rosterId =
        ts?.roster_id != null && ts.roster_id !== ""
          ? String(ts.roster_id)
          : row?.Roster?.id != null
          ? String(row.Roster.id)
          : "";
      const uid = String(ts.user_id);

      if (rosterId) {
        const prev = byRoster.get(rosterId);
        const sPrev = score(prev);
        const sCur = score(ts);
        if (!prev || sCur > sPrev || (sCur === sPrev && String(ts.clocked_in ?? "") > String(prev?.clocked_in ?? ""))) {
          byRoster.set(rosterId, ts);
        }
      }

      {
        const prev = byUser.get(uid);
        const sPrev = score(prev);
        const sCur = score(ts);
        if (!prev || sCur > sPrev || (sCur === sPrev && String(ts.clocked_in ?? "") > String(prev?.clocked_in ?? ""))) {
          byUser.set(uid, ts);
        }
      }
    }

    return { byRoster, byUser };
  }, [clocksResp]);

  // TIMESHEETS (oude stijl) idem per roster/user
  const plainBy = useMemo(() => {
    const score = (t?: TimesheetRow["Timesheet"]) =>
      (t?.clocked_in ? 1 : 0) + (t?.clocked_out ? 1 : 0);

    const byRoster = new Map<string, TimesheetRow["Timesheet"]>();
    const byUser = new Map<string, TimesheetRow["Timesheet"]>();

    for (const row of (timesheetsResp?.data ?? [])) {
      const ts = row.Timesheet;
      const rosterId = ts?.roster_id ? String(ts.roster_id) : "";
      const uid = String(ts.user_id);

      if (rosterId) {
        const prev = byRoster.get(rosterId);
        const sPrev = score(prev);
        const sCur = score(ts);
        if (!prev || sCur > sPrev || (sCur === sPrev && String(ts.clocked_in ?? "") > String(prev?.clocked_in ?? ""))) {
          byRoster.set(rosterId, ts);
        }
      }

      {
        const prev = byUser.get(uid);
        const sPrev = score(prev);
        const sCur = score(ts);
        if (!prev || sCur > sPrev || (sCur === sPrev && String(ts.clocked_in ?? "") > String(prev?.clocked_in ?? ""))) {
          byUser.set(uid, ts);
        }
      }
    }

    return { byRoster, byUser };
  }, [timesheetsResp]);

  // ---- WEEK ----
  const weekDates = useMemo(() => {
    const s = startOfISOWeekMonday(new Date(selectedDate + "T12:00:00"));
    return Array.from({ length: 7 }, (_, i) =>
      ymdLocal(new Date(s.getFullYear(), s.getMonth(), s.getDate() + i))
    );
  }, [selectedDate]);

  const weekKey = view === "week" ? `week:${weekDates.join("|")}` : null;

  const { data: weekRooster, error: weekError } = useSWR<Record<string, ShiftItem[]>>(
    weekKey,
    async () => {
      if (!weekDates.length) return {};
      const res = await Promise.all(
        weekDates.map((d) => fetch(`/api/shiftbase/rooster?datum=${d}`).then((r) => r.json()))
      );
      const out: Record<string, ShiftItem[]> = {};
      weekDates.forEach((d, i) => {
        out[d] = Array.isArray(res[i]) ? res[i] : [];
      });
      return out;
    }
  );

  const weekUserIds = useMemo(() => {
    const s = new Set<string>();
    if (weekRooster) {
      Object.values(weekRooster).forEach((items) =>
        (items ?? []).forEach((it) => s.add(String(it.Roster.user_id)))
      );
    }
    return Array.from(s);
  }, [weekRooster]);

  const wagesUrl =
    view === "week" && weekRooster
      ? `/api/shiftbase/wages-by-age?min_date=${weekDates[0]}&max_date=${weekDates[6]}&user_ids=${encodeURIComponent(
          weekUserIds.join(",")
        )}`
      : null;

  const { data: wagesByAge, error: wagesError } = useSWR<WageByAgeResp>(wagesUrl, fetcher);

  const wageByDateUser = useMemo(() => {
    const out = new Map<string, Map<string, { wage: number; factor: number }>>();
    for (const row of wagesByAge?.data ?? []) {
      const uid = String(row.user_id);
      if (!out.has(row.date)) out.set(row.date, new Map());
      out.get(row.date)!.set(uid, {
        wage: row.wage,
        factor: getEffectiveFactor(row),
      });
    }
    return out;
  }, [wagesByAge]);

  const weekTotals = useMemo(() => {
    if (!weekRooster) return { hours: 0, cost: 0 };
    let hours = 0;
    let cost = 0;
    for (const d of weekDates) {
      const roster = weekRooster[d] || [];
      const perShift: Record<string, ShiftItem[]> = {};
      for (const item of roster) (perShift[item.Roster.name] ||= []).push(item);
      Object.values(perShift).forEach((arr) =>
        arr.sort((a, b) => a.Roster.starttime.localeCompare(b.Roster.starttime))
      );
      const wageMap = wageByDateUser.get(d);
      for (const items of Object.values(perShift)) {
        for (const it of items) {
          const uid = String(it.Roster.user_id);
          if (excluded.has(keyDU(d, uid))) continue;
          const h = hoursBetween(it.Roster.starttime, it.Roster.endtime);
          hours += h;
          const entry = wageMap?.get(uid);
          const wage = entry?.wage ?? 0;
          const factor = entry?.factor ?? DEFAULT_FACTOR;
          if (wage > 0 && h > 0) cost += h * wage * factor;
        }
      }
    }
    return { hours, cost };
  }, [weekRooster, weekDates, wageByDateUser, excluded]);

  // ==== MAAND (PLANNING) voor DAGVIEW ====
  const monthDates = useMemo(() => {
    const base = new Date(selectedDate + "T12:00:00");
    const y = base.getFullYear();
    const m = base.getMonth();
    const end = new Date(y, m + 1, 0);
    const list: string[] = [];
    for (let d = 1; d <= end.getDate(); d++) list.push(ymdLocal(new Date(y, m, d)));
    return list;
  }, [selectedDate]);

  const monthKey = view === "day" ? `month:${monthDates.join("|")}` : null;

  const { data: monthRooster } = useSWR<Record<string, ShiftItem[]>>(
    monthKey,
    async () => {
      if (!monthDates.length) return {};
      const res = await Promise.all(
        monthDates.map((d) => fetch(`/api/shiftbase/rooster?datum=${d}`).then((r) => r.json()))
      );
      const out: Record<string, ShiftItem[]> = {};
      monthDates.forEach((d, i) => {
        out[d] = Array.isArray(res[i]) ? res[i] : [];
      });
      return out;
    }
  );

  const monthUserIds = useMemo(() => {
    const s = new Set<string>();
    if (monthRooster) {
      Object.values(monthRooster).forEach((items) =>
        (items ?? []).forEach((it) => s.add(String(it.Roster.user_id)))
      );
    }
    return Array.from(s);
  }, [monthRooster]);

  const wagesUrlMonth =
    view === "day" && monthRooster && monthUserIds.length
      ? `/api/shiftbase/wages-by-age?min_date=${monthDates[0]}&max_date=${monthDates[monthDates.length - 1]}&user_ids=${encodeURIComponent(
          monthUserIds.join(",")
        )}`
      : null;

  const { data: wagesByAgeMonth } = useSWR<WageByAgeResp>(wagesUrlMonth, fetcher);

  const wageByDateUserMonth = useMemo(() => {
    const out = new Map<string, Map<string, { wage: number; factor: number }>>();
    for (const row of wagesByAgeMonth?.data ?? []) {
      const uid = String(row.user_id);
      if (!out.has(row.date)) out.set(row.date, new Map());
      out.get(row.date)!.set(uid, { wage: row.wage, factor: getEffectiveFactor(row) });
    }
    return out;
  }, [wagesByAgeMonth]);

  const monthTotals = useMemo(() => {
    if (!monthRooster) return { hours: 0, cost: 0 };
    let hours = 0;
    let cost = 0;
    for (const d of monthDates) {
      const roster = monthRooster[d] || [];
      const perShift: Record<string, ShiftItem[]> = {};
      for (const item of roster) (perShift[item.Roster.name] ||= []).push(item);
      Object.values(perShift).forEach((arr) =>
        arr.sort((a, b) => a.Roster.starttime.localeCompare(b.Roster.starttime))
      );
      const wageMap = wageByDateUserMonth.get(d);
      for (const items of Object.values(perShift)) {
        for (const it of items) {
          const uid = String(it.Roster.user_id);
          const h = hoursBetween(it.Roster.starttime, it.Roster.endtime);
          hours += h;
          const entry = wageMap?.get(uid);
          const wage = entry?.wage ?? 0;
          const factor = entry?.factor ?? DEFAULT_FACTOR;
          if (wage > 0 && h > 0) cost += h * wage * factor;
        }
      }
    }
    return { hours, cost };
  }, [monthRooster, monthDates, wageByDateUserMonth]);

  // Tekst voor masker (één plek regelen)
  const costNum = monthRooster ? Math.round(monthTotals.cost) : null;
  const costTxt = costNum != null ? EUR0.format(costNum) : "—";
  const hoursNum = monthRooster ? Math.round(monthTotals.hours * 100) / 100 : 0;
  const hoursTxt = hoursNum.toLocaleString("nl-NL");
  const showCost = mask ? maskDigits(costTxt) : costTxt;
  const showHours = mask ? maskDigits(hoursTxt) : hoursTxt;

  const changeDay = (off: number) =>
    setSelectedDate((prev) => addDays(prev, view === "day" ? off : off * 7));
  const goToday = () => setSelectedDate(today);

  return (
    <div className="p-4">
      {/* Nav */}
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
        <button
          onClick={goToday}
          className="ml-2 px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
        >
          Vandaag
        </button>
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => setView("day")}
            className={`px-3 py-1 rounded border ${
              view === "day" ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-100"
            }`}
          >
            Dag
          </button>
          <button
            onClick={() => setView("week")}
            className={`px-3 py-1 rounded border ${
              view === "week" ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-100"
            }`}
          >
            Week
          </button>
        </div>
      </div>

      {/* Titels */}
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
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold">
            Rooster week{" "}
            {new Date(weekDates[0] + "T12:00:00").toLocaleDateString("nl-NL", {
              day: "2-digit",
              month: "2-digit",
            })}{" "}
            –{" "}
            {new Date(weekDates[6] + "T12:00:00").toLocaleDateString("nl-NL", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </h1>
        </div>
      )}

      {/* DAGVIEW (ingekort: jouw bestaande dagweergave met kaart hierboven) */}
      {view === "day" ? (
        <>
          {/* ... jouw dagweergave blijft ongewijzigd (staat hierboven in je eigen code) ... */}
        </>
      ) : (
        // WEEKVIEW
        <>
          {weekError && (
            <p className="p-4 text-red-600">
              Fout weekrooster: {String(weekError?.message ?? weekError)}
            </p>
          )}
          {wagesError && (
            <p className="p-4 text-red-600">
              Fout lonen (leeftijd): {String(wagesError?.message ?? wagesError)}
            </p>
          )}

          {!weekRooster ? (
            <p className="p-4">Laden…</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
                {weekDates.map((d) => {
                  const roster = weekRooster[d] || [];

                  // per shift groeperen
                  const perShift: Record<string, ShiftItem[]> = {};
                  for (const item of roster) (perShift[item.Roster.name] ||= []).push(item);
                  Object.values(perShift).forEach((arr) =>
                    arr.sort((a, b) => a.Roster.starttime.localeCompare(b.Roster.starttime))
                  );
                  const order = [
                    ...GEWENSTE.filter((n) => n in perShift),
                    ...Object.keys(perShift).filter((n) => !GEWENSTE.includes(n)),
                  ];

                  const wageMap = wageByDateUser.get(d);

                  let dayCost = 0;
                  let planned = 0;
                  let withWage = 0;
                  let totalHours = 0;
                  let excludedCount = 0;

                  for (const items of Object.values(perShift)) {
                    for (const it of items) {
                      planned += 1;
                      const uid = String(it.Roster.user_id);
                      const ex = excluded.has(keyDU(d, uid));
                      const hours = hoursBetween(it.Roster.starttime, it.Roster.endtime);

                      if (ex) {
                        excludedCount += 1;
                        continue;
                      }

                      totalHours += hours;

                      const entry = wageMap?.get(uid);
                      const wage = entry?.wage ?? 0;
                      const factor = entry?.factor ?? DEFAULT_FACTOR;

                      if (wage > 0 && hours > 0) {
                        withWage += 1;
                        dayCost += hours * wage * factor;
                      }
                    }
                  }

                  const requiredRevenue25 = dayCost > 0 ? Math.round(dayCost / 0.25) : 0;
                  const requiredRevenue23 = dayCost > 0 ? Math.round(dayCost / 0.23) : 0;

                  return (
                    <div key={d} className="border rounded-lg p-2 text-xs leading-tight flex flex-col">
                      <div className="flex items-baseline justify-between mb-2">
                        <h3 className="font-semibold">
                          {new Date(d + "T12:00:00").toLocaleDateString("nl-NL", {
                            weekday: "short",
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </h3>
                        <div className="flex items-center gap-1">
                          {excludedCount > 0 && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-900">
                              −{excludedCount}
                            </span>
                          )}
                          {d === today && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                              vandaag
                            </span>
                          )}
                        </div>
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
                                className="text-[11px] font-semibold mb-1 px-2 py-0.5 rounded text-white"
                                style={{ backgroundColor: headerColor }}
                              >
                                {headerText}
                              </div>
                              <ul className="pl-0 list-none space-y-1">
                                {groep.map((it) => {
                                  const uid = String(it.Roster.user_id);
                                  const isExcluded = excluded.has(keyDU(d, uid));

                                  // ➕ Tooltip met ingeplande tijd
                                  const schedIn  = it.Roster.starttime?.slice(0, 5) ?? "--";
                                  const schedOut = it.Roster.endtime?.slice(0, 5) ?? "--";
                                  const hrs = hoursBetween(it.Roster.starttime, it.Roster.endtime);
                                  const tooltip = `Ingepland: ${schedIn}–${schedOut} (${hrs.toFixed(2)} uur)`;

                                  return (
                                    <li key={it.id}>
                                      <button
                                        type="button"
                                        aria-pressed={!isExcluded}
                                        onClick={() => toggleExcluded(d, uid)}
                                        className={`w-full text-left px-2 py-1 rounded border transition cursor-help ${
                                          isExcluded
                                            ? "line-through opacity-60 border-red-300 bg-red-50 hover:bg-red-100"
                                            : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                                        }`}
                                        title={tooltip}
                                        aria-label={`${firstName(it.User?.name)} — ${tooltip}`}
                                      >
                                        <strong className="truncate">{firstName(it.User?.name)}</strong>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          );
                        })
                      )}

                      <div className="mt-auto pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] text-gray-700">
                            Personeelskosten incl. lasten{" "}
                            <span className="opacity-60">
                              ({withWage}/{planned - excludedCount} met tarief)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => clearExcludedForDay(d)}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-gray-300 hover:bg-gray-100"
                          >
                            Reset
                          </button>
                        </div>

                        <div className="text-right text-sm font-semibold">
                          {dayCost > 0 ? EUR0.format(Math.round(dayCost)) : "—"}
                        </div>
                        <div className="mt-1 text-[10px] text-gray-600 text-right">
                          Totaal uren: <strong>{Math.round(totalHours * 100) / 100}</strong>
                        </div>
                        {dayCost > 0 && (
                          <>
                            <div className="mt-0.5 text-[10px] text-gray-600 text-right">
                              Omzet voor LK &lt; 25%:{" "}
                              <strong>{EUR0.format(requiredRevenue25)}</strong>
                            </div>
                            <div className="mt-0.5 text-[10px] text-gray-600 text-right">
                              Omzet voor LK &lt; 23%:{" "}
                              <strong>{EUR0.format(requiredRevenue23)}</strong>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Weektotaal */}
              <div className="mt-4 border rounded-lg p-3 bg-gray-50">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">Weektotaal (incl. leeftijdsopslag)</div>
                    <div className="text-xs text-gray-600">
                      Periode:{" "}
                      {new Date(weekDates[0] + "T12:00:00").toLocaleDateString("nl-NL", {
                        day: "2-digit",
                        month: "2-digit",
                      })}{" "}
                      –{" "}
                      {new Date(weekDates[6] + "T12:00:00").toLocaleDateString("nl-NL", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{EUR0.format(Math.round(weekTotals.cost))}</div>
                    <div className="text-xs text-gray-600">
                      Omzet voor loonkosten &lt; 25%:{" "}
                      <strong>{EUR0.format(Math.round(weekTotals.cost / 0.25 || 0))}</strong>
                    </div>
                    <div className="text-xs text-gray-600">
                      Omzet voor loonkosten &lt; 23%:{" "}
                      <strong>{EUR0.format(Math.round(weekTotals.cost / 0.23 || 0))}</strong>
                    </div>
                    <div className="text-xs text-gray-600">
                      Totaal uren: <strong>{Math.round(weekTotals.hours * 100) / 100}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
