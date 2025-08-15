// ===========================
// File: src/app/admin/shiftbase/rooster/page.tsx
// ===========================
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

type TimesheetRow = {
  Timesheet: {
    user_id: string | number;
    date?: string;
    clocked_in?: string | null;
    clocked_out?: string | null;
    total?: string | number | null;
    status?: string | null;
  };
};

type WageByAgeRow = { date: string; user_id: string | number; wage: number };
type WageByAgeMeta = {
  users_total: number;
  users_without_dob: string[];
  rules_total?: number;
  rules_date_coverage?: Record<string, boolean>;
  no_rule_match_per_date?: Record<string, string[]>;
  users_with_wage_per_date?: Record<string, string[]>;
  min_date?: string;
  max_date?: string;
  filtered_to_user_ids?: boolean;
};
type WageByAgeResp = { data?: WageByAgeRow[]; meta?: WageByAgeMeta } | null;

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
  const day = (t.getDay() + 6) % 7; // Ma=0..Zo=6
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

const EUR0 = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const GEWENSTE = [
  "S1K",
  "S1KV",
  "S1",
  "S1Z",
  "S1L",
  "S1S",
  "S2K",
  "S2",
  "S2L",
  "S2S",
  "SPS",
  "SLW1",
  "SLW2",
];

// key helper voor include/exclude per dag+user
const keyDU = (date: string, userId: string | number) => `${date}:${String(userId)}`;

export default function RoosterPage() {
  const today = ymdLocal(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState<"day" | "week">("day");
  const [showChecks, setShowChecks] = useState<boolean>(false);

  // ✅ set met uitgesloten (dag:user) combinaties
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const toggleExcluded = (date: string, userId: string | number) =>
    setExcluded((prev) => {
      const n = new Set(prev);
      const k = keyDU(date, userId);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const clearExcludedForDay = (date: string) =>
    setExcluded((prev) => {
      const n = new Set<string>();
      for (const k of prev) if (!k.startsWith(date + ":")) n.add(k);
      return n;
    });

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
      orderDay: [...GEWENSTE.filter((n) => n in acc), ...present.filter((n) => !GEWENSTE.includes(n))],
    };
  }, [dayRooster]);

  // ✅ Timesheets alleen ophalen als het om vandaag in dagview gaat
  const loadTimesheets = view === "day" && selectedDate === today;
  const { data: timesheetsResp } = useSWR<{ data?: TimesheetRow[] }>(
    loadTimesheets
      ? `/api/shiftbase/timesheets?min_date=${selectedDate}&max_date=${selectedDate}`
      : null,
    fetcher
  );
  // Map met de béste timesheet per user_id (voorkeur: regels met tijden)
const timesheetByUser = useMemo(() => {
  const map = new Map<string, TimesheetRow["Timesheet"]>();

  const score = (t?: TimesheetRow["Timesheet"]) =>
    (t?.clocked_in ? 1 : 0) + (t?.clocked_out ? 1 : 0);

  for (const row of timesheetsResp?.data ?? []) {
    const ts = row.Timesheet;
    const uid = String(ts.user_id);

    const prev = map.get(uid);
    const sPrev = score(prev);
    const sCur = score(ts);

    // Kies de regel met meeste ingevulde tijden; bij gelijkspel: latere in-tijd
    if (
      !prev ||
      sCur > sPrev ||
      (sCur === sPrev &&
        ts.clocked_in &&
        (!prev.clocked_in || String(ts.clocked_in) > String(prev.clocked_in)))
    ) {
      map.set(uid, ts);
    }
  }

  return map;
}, [timesheetsResp]);


  // ---- WEEK ----
  const weekDates = useMemo(() => {
    const s = startOfISOWeekMonday(new Date(selectedDate + "T12:00:00"));
    return Array.from({ length: 7 }, (_, i) =>
      ymdLocal(new Date(s.getFullYear(), s.getMonth(), s.getDate() + i))
    );
  }, [selectedDate]);

  // ✅ string key i.p.v. tuple (lost ESLint error op)
  const weekKey = view === "week" ? `week:${weekDates.join("|")}` : null;

  const { data: weekRooster, error: weekError } = useSWR<Record<string, ShiftItem[]>>(
    weekKey,
    async () => {
      if (!weekDates?.length) return {};
      const res = await Promise.all(
        weekDates.map((d) => fetch(`/api/shiftbase/rooster?datum=${d}`).then((r) => r.json()))
      );
      const out: Record<string, ShiftItem[]> = {};
      weekDates.forEach((d, i) => (out[d] = Array.isArray(res[i]) ? res[i] : []));
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

  // Map: date -> (user_id -> wage)
  const wageByDateUser = useMemo(() => {
    const out = new Map<string, Map<string, number>>();
    for (const row of (wagesByAge?.data ?? []) as WageByAgeRow[]) {
      const uid = String(row.user_id);
      if (!out.has(row.date)) out.set(row.date, new Map());
      out.get(row.date)!.set(uid, row.wage);
    }
    return out;
  }, [wagesByAge]);

  // Week-totaal berekenen (meeloopt met exclusions)
  const weekTotals = useMemo(() => {
    if (!weekRooster) return { hours: 0, cost: 0 };
    let hours = 0;
    let cost = 0;
    for (const d of weekDates) {
      const roster = weekRooster[d] || [];
      // per shift groeperen
      const perShift: Record<string, ShiftItem[]> = {};
      for (const item of roster) (perShift[item.Roster.name] ||= []).push(item);
      Object.values(perShift).forEach((arr) =>
        arr.sort((a, b) => a.Roster.starttime.localeCompare(b.Roster.starttime))
      );
      const wageMap = wageByDateUser.get(d);
      for (const items of Object.values(perShift)) {
        for (const it of items) {
          const uid = String(it.Roster.user_id);
          if (excluded.has(keyDU(d, uid))) continue; // uitgesloten → overslaan
          const h = hoursBetween(it.Roster.starttime, it.Roster.endtime);
          hours += h;
          const wage = wageMap?.get(uid) ?? 0;
          if (wage > 0 && h > 0) cost += h * wage * 1.36; // incl. werkgeverslasten
        }
      }
    }
    return { hours, cost };
  }, [weekRooster, weekDates, wageByDateUser, excluded]);

  const changeDay = (off: number) => setSelectedDate((prev) => addDays(prev, view === "day" ? off : off * 7));
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

      {/* Titel + controles-toggle in week */}
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
          <button
            onClick={() => setShowChecks((s) => !s)}
            className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
          >
            {showChecks ? "Verberg controles" : "Toon controles"}
          </button>
        </div>
      )}

      {/* DAGVIEW */}
      {view === "day" ? (
        <>
          {dayError && (
            <p className="p-4 text-red-600">
              Fout bij laden rooster: {String(dayError?.message ?? dayError)}
            </p>
          )}
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
                  <h2
                    className="text-lg font-semibold mb-1 px-2 py-1 rounded text-white"
                    style={{ backgroundColor: headerColor }}
                  >
                    {headerText}
                  </h2>
                  <ul className="pl-4 list-disc">
                    {groep.map((it) => {
                      const uid = String(it.Roster.user_id);
                      const ts = timesheetByUser.get(uid);

                      // badge met kloktijden (alleen op vandaag)
                      const inTime =
                        ts?.clocked_in ? String(ts.clocked_in).substring(11, 16) : "--";
                      const outTime =
                        ts?.clocked_out ? String(ts.clocked_out).substring(11, 16) : "--";

                      // kleur voor status
                      let badgeClass = "bg-red-100 text-red-800";
                      if (ts?.clocked_in && ts?.clocked_out) badgeClass = "bg-green-100 text-green-800";
                      else if (ts?.clocked_in || ts?.clocked_out) badgeClass = "bg-orange-100 text-orange-800";

                      return (
                        <li key={it.id} className="mb-1">
                          {selectedDate === today && (
                            <span className="font-semibold">
                              {it.Roster.starttime.slice(0, 5)}–{it.Roster.endtime.slice(0, 5)}
                            </span>
                          )}{" "}
                          <strong>{it.User?.name || "Onbekend"}</strong>
                          {selectedDate === today && (
                            <span
                              className={`ml-2 mt-1 inline-flex items-center gap-1 text-[11px] ${badgeClass} px-2 py-0.5 rounded`}
                              title="Kloktijden (vandaag)"
                            >
                              ⏱ In: {inTime} · Uit: {outTime}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })
          )}
        </>
      ) : (
        // WEEKVIEW + Exclude/Include knoppen
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

          {showChecks && wagesByAge?.meta && (
            <div className="mb-3 rounded border p-3 text-sm bg-gray-50">
              <div className="font-semibold mb-1">Controles (globaal)</div>
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <div>
                    Users in weekrooster: <strong>{weekUserIds.length}</strong>
                  </div>
                  <div>
                    Users NAW geladen: <strong>{wagesByAge.meta.users_total}</strong>
                  </div>
                  <div>
                    Zonder geboortedatum (uniek):{" "}
                    {wagesByAge.meta.users_without_dob.length ? (
                      <span className="text-amber-700">
                        {wagesByAge.meta.users_without_dob.join(", ")}
                      </span>
                    ) : (
                      <span className="text-green-700">0</span>
                    )}
                  </div>
                </div>
                <div>
                  <div>
                    Gefilterd op user_ids:{" "}
                    <strong>{wagesByAge.meta.filtered_to_user_ids ? "ja" : "nee"}</strong>
                  </div>
                </div>
              </div>
            </div>
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

                  // berekenen met include/exclude
                  for (const items of Object.values(perShift)) {
                    for (const it of items) {
                      planned += 1;
                      const uid = String(it.Roster.user_id);
                      const ex = excluded.has(keyDU(d, uid));
                      const hours = hoursBetween(it.Roster.starttime, it.Roster.endtime);

                      if (ex) {
                        excludedCount += 1;
                        // uitgesloten: niet meetellen in uren/kosten
                        continue;
                      }

                      totalHours += hours;

                      const wage = wageMap?.get(uid) ?? 0;
                      if (wage > 0 && hours > 0) {
                        withWage += 1;
                        dayCost += hours * wage * 1.36; // werkgeverslasten
                      }
                    }
                  }

                  const requiredRevenue = dayCost > 0 ? Math.round(dayCost / 0.25) : 0;

                  // meta (optioneel)
                  const meta = wagesByAge?.meta;
                  const usersNoRule = meta?.no_rule_match_per_date?.[d] ?? [];
                  const usersWithWage = meta?.users_with_wage_per_date?.[d] ?? [];

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
                              {/* ✅ Buttons per medewerker (toggle include/exclude) */}
                              <ul className="pl-0 list-none space-y-1">
                                {groep.map((it) => {
                                  const uid = String(it.Roster.user_id);
                                  const isExcluded = excluded.has(keyDU(d, uid));
                                  return (
                                    <li key={it.id}>
                                      <button
                                        type="button"
                                        aria-pressed={!isExcluded}
                                        onClick={() => toggleExcluded(d, uid)}
                                        className={`w-full text-left px-2 py-1 rounded border transition ${
                                          isExcluded
                                            ? "line-through opacity-60 border-red-300 bg-red-50 hover:bg-red-100"
                                            : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                                        }`}
                                        title={isExcluded ? "Uitgesloten uit kosten" : "Meenemen in kosten"}
                                      >
                                        <strong>{firstName(it.User?.name)}</strong>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          );
                        })
                      )}

                      {/* Onderkant: kosten/uren/omzet + reset */}
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
                            title="Reset selectie voor deze dag"
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
                          <div className="mt-0.5 text-[10px] text-gray-600 text-right">
                            Omzet voor &lt; 25%: <strong>{EUR0.format(requiredRevenue)}</strong>
                          </div>
                        )}

                        {(showChecks && (usersNoRule.length > 0 || (meta?.users_without_dob?.length ?? 0) > 0)) && (
                          <div className="mt-2 space-y-1">
                            {usersNoRule.length > 0 && (
                              <div className="text-[11px] px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                Geen match met tariefladder op {d}: {usersNoRule.join(", ")}
                              </div>
                            )}
                            {meta?.users_without_dob?.length ? (
                              <div className="text-[11px] px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                Zonder geboortedatum (algemeen): {meta.users_without_dob.join(", ")}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ✅ Weektotaal */}
              <div className="mt-4 border rounded-lg p-3 bg-gray-50">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">Weektotaal (inclusief ×1.36)</div>
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
                    <div className="text-2xl font-bold">
                      {EUR0.format(Math.round(weekTotals.cost))}
                    </div>
                    <div className="text-xs text-gray-600">
                      Omzet voor &lt; 25%:{" "}
                      <strong>{EUR0.format(Math.round(weekTotals.cost / 0.25 || 0))}</strong>
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
