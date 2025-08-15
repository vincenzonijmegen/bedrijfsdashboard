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
    name: string;      // short code (e.g. "S1K")
    color?: string;    // hex/rgb
    user_id: string;
  };
  Shift?: { long_name: string };
  User?: { id: string; name: string };
};

type TimesheetRow = {
  Timesheet: {
    user_id: string;
    date: string; // "YYYY-MM-DD"
    clocked_in: string | null;  // ISO or "YYYY-MM-DDTHH:MM:SS"
    clocked_out: string | null; // idem
    total?: string | null;
    status?: string | null;
  };
};

type TimesheetResp = { data?: TimesheetRow[] } | null;

// --- Utils ----------------------------------------------------
// Bouw lokale YYYY-MM-DD zonder UTC verschuiving
function ymdLocal(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hhmm(s?: string | null) {
  if (!s) return "--";
  // verwacht ISO of "YYYY-MM-DDTHH:MM[:SS]"
  const t = s.includes("T") ? s.split("T")[1] : s;
  return t.slice(0, 5);
}

function classByTimesheet(entry?: TimesheetRow["Timesheet"]) {
  if (!entry) return "bg-red-100 text-red-800"; // niets gevonden
  const { clocked_in, clocked_out } = entry;
  if (clocked_in && clocked_out) return "bg-green-100 text-green-800";
  if (clocked_in || clocked_out) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

const GEWENSTE_VOLGORDE = [
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

// --- Component ------------------------------------------------
export default function RoosterPage() {
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<string>(() => ymdLocal(today));

  useEffect(() => {
    console.log("[DEBUG] Geselecteerde datum gewijzigd:", selectedDate);
  }, [selectedDate]);

  // Rooster
  const { data: rosterData, error } = useSWR<ShiftItem[]>(
    () => `/api/shiftbase/rooster?datum=${selectedDate}`,
    fetcher
  );

  // Timesheets (alleen voor geselecteerde dag — snelle map lookup)
  const { data: timesheetResp } = useSWR<TimesheetResp>(
    () =>
      `/api/shiftbase/timesheets?min_date=${selectedDate}&max_date=${selectedDate}`,
    fetcher
  );

  useEffect(() => {
    console.log("[DEBUG] timesheetData", timesheetResp);
  }, [timesheetResp]);

  // Maak een map per user_id voor snelle lookup (alleen matching date)
  const tsByUser = useMemo(() => {
    const map = new Map<string, TimesheetRow["Timesheet"]>();
    const rows = timesheetResp?.data ?? [];
    for (const r of rows) {
      if (r?.Timesheet?.date === selectedDate) {
        map.set(r.Timesheet.user_id, r.Timesheet);
      }
    }
    return map;
  }, [timesheetResp, selectedDate]);

  const changeDay = (offset: number) => {
    const d = new Date(selectedDate + "T12:00:00"); // fix DST klapper
    d.setDate(d.getDate() + offset);
    setSelectedDate(ymdLocal(d));
  };

  const goToday = () => setSelectedDate(ymdLocal(new Date()));

  if (error)
    return (
      <p className="p-4 text-red-600">
        Fout bij laden rooster: {error.message ?? "onbekend"}
      </p>
    );
  if (!rosterData) return <p className="p-4">Laden…</p>;

  // Groepeer per shiftnaam en sorteer binnen shift op starttijd
  const perShift = useMemo(() => {
    const acc: Record<string, ShiftItem[]> = {};
    for (const item of rosterData) {
      const key = item.Roster.name;
      (acc[key] ||= []).push(item);
    }
    for (const key of Object.keys(acc)) {
      acc[key].sort((a, b) =>
        a.Roster.starttime.localeCompare(b.Roster.starttime)
      );
    }
    return acc;
  }, [rosterData]);

  // Bepaal render-volgorde
  const order = useMemo(() => {
    const present = Object.keys(perShift);
    const pref = GEWENSTE_VOLGORDE.filter((n) => n in perShift);
    const rest = present.filter((n) => !GEWENSTE_VOLGORDE.includes(n));
    return pref.concat(rest);
  }, [perShift]);

  const isToday = selectedDate === ymdLocal(today);

  return (
    <div className="p-4">
      {/* Navigatie */}
      <div className="flex items-center mb-4 gap-2">
        <button
          onClick={() => changeDay(-1)}
          className="px-2 py-1 bg-gray-200 rounded"
          aria-label="Vorige dag"
        >
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
        <button
          onClick={() => changeDay(1)}
          className="px-2 py-1 bg-gray-200 rounded"
          aria-label="Volgende dag"
        >
          →
        </button>
        <button
          onClick={goToday}
          className="ml-2 px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
        >
          Vandaag
        </button>
      </div>

      <h1 className="text-xl font-bold mb-2">
        Rooster voor{" "}
        {new Date(selectedDate + "T12:00:00").toLocaleDateString("nl-NL", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })}
      </h1>

      {order.length === 0 ? (
        <p>Geen shifts gevonden voor deze dag.</p>
      ) : (
        order.map((shiftName) => {
          const groep = perShift[shiftName];
          const headerColor = groep?.[0]?.Roster?.color || "#334";
          const headerText = groep?.[0]?.Shift?.long_name || shiftName;

          return (
            <div key={shiftName} className="mb-6">
              <h2
                className="text-lg font-semibold mb-1 px-2 rounded"
                style={{ backgroundColor: headerColor, color: "white" }}
              >
                {headerText}
              </h2>

              <ul className="pl-4 list-disc">
                {groep.map((item) => {
                  const ts = tsByUser.get(item.Roster.user_id);
                  const badgeClass = classByTimesheet(ts);

                  return (
                    <li key={item.id} className="mb-1 flex flex-wrap gap-2">
                      <span className="mr-2">
                        <span className="font-semibold">
                          {item.Roster.starttime.slice(0, 5)}–
                          {item.Roster.endtime.slice(0, 5)}
                        </span>{" "}
                        <strong>{item.User?.name || "Onbekend"}</strong>
                      </span>

                      {/* Timesheet-badge tonen voor alle dagen;
                          wil je dit alléén op vandaag, vervang "true" door isToday */}
                      {true && (
                        <div
                          className={`flex items-center gap-2 text-sm ${badgeClass} px-2 py-0.5 rounded`}
                        >
                          <span aria-hidden>⏱</span>
                          <span>In: {hhmm(ts?.clocked_in)}</span>
                          <span>Uit: {hhmm(ts?.clocked_out)}</span>
                        </div>
                      )}
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
}
