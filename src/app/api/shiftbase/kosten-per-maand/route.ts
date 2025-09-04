// src/app/api/shiftbase/kosten-per-maand/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Types afgestemd op jouw bestaande endpoints
type ShiftItem = {
  id: string;
  Roster: {
    id?: string | number;
    starttime: string; // "HH:MM"
    endtime: string;   // "HH:MM"
    name: string;
    color?: string;
    user_id: string | number;
  };
  Shift?: { long_name: string };
  User?: { id: string | number; name: string };
};

type WageRow = {
  date: string;               // "YYYY-MM-DD"
  user_id: string | number;
  wage: number;               // let op: in jouw API nu al inclusief opslag (we hebben dat net zo gemaakt)
};

type WagesResp = { data?: WageRow[] } | null;

// helpers
function isIsoDate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
function pad2(n: number) { return String(n).padStart(2, "0"); }
function daysInMonth(y: number, m1_12: number) {
  return new Date(y, m1_12, 0).getDate(); // m1_12 = 1..12
}
function hoursBetween(a: string, b: string) {
  const [sh, sm] = a.split(":").map(Number);
  const [eh, em] = b.split(":").map(Number);
  let m = eh * 60 + em - (sh * 60 + sm);
  if (m < 0) m += 1440; // over middernacht
  return m / 60;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jaar = Number(url.searchParams.get("jaar"));
  const maand = Number(url.searchParams.get("maand")); // 1..12
  const format = (url.searchParams.get("format") || "json").toLowerCase(); // "json" | "csv"

  if (!jaar || !maand || maand < 1 || maand > 12) {
    return NextResponse.json({ error: "Gebruik ?jaar=YYYY&maand=1..12&format=json|csv" }, { status: 400 });
  }

  const first = `${jaar}-${pad2(maand)}-01`;
  if (!isIsoDate(first)) {
    return NextResponse.json({ error: "Ongeldige datumparameters" }, { status: 400 });
  }
  const ndays = daysInMonth(jaar, maand);

  // 1) Alle roosteritems per dag ophalen
  const dayKeys: string[] = Array.from({ length: ndays }, (_, i) => `${jaar}-${pad2(maand)}-${pad2(i + 1)}`);
  const rosterByDate: Record<string, ShiftItem[]> = {};
  const allUserIds = new Set<string>();

  const rosterResults = await Promise.all(
    dayKeys.map(async (d) => {
      const r = await fetch(`${url.origin}/api/shiftbase/rooster?datum=${d}`, { headers: { Accept: "application/json" }, cache: "no-store" });
      const arr = r.ok ? ((await r.json()) as ShiftItem[]) : [];
      rosterByDate[d] = Array.isArray(arr) ? arr : [];
      for (const it of rosterByDate[d]) allUserIds.add(String(it.Roster.user_id));
      return null;
    })
  );

  // 2) Maand-wages ophalen (1 call) voor alleen de ingeplande users
  const userIdCsv = Array.from(allUserIds).join(",");
  const wagesUrl = `${url.origin}/api/shiftbase/wages-by-age?min_date=${first}&max_date=${jaar}-${pad2(maand)}-${pad2(ndays)}&user_ids=${encodeURIComponent(userIdCsv)}`;
  const wagesResp = await fetch(wagesUrl, { headers: { Accept: "application/json" }, cache: "no-store" });
  const wagesJson = wagesResp.ok ? ((await wagesResp.json()) as WagesResp) : null;

  // Bouw map: date -> (user_id -> wage)
  const wageByDateUser = new Map<string, Map<string, number>>();
  for (const row of wagesJson?.data ?? []) {
    const uid = String(row.user_id);
    if (!wageByDateUser.has(row.date)) wageByDateUser.set(row.date, new Map());
    wageByDateUser.get(row.date)!.set(uid, row.wage);
  }

  // 3) Aggregatie per medewerker
  type Agg = {
    user_id: string;
    name: string;
    shifts: number;
    daysWorked: number;
    hours: number;
    cost: number;
    missingWage: number; // aantal shifts zonder wage (bijv. ontbrekende DOB)
  };
  const byUser = new Map<string, Agg>();

  for (const d of dayKeys) {
    const items = rosterByDate[d] || [];
    const dayUsers = new Set<string>();
    const wageMap = wageByDateUser.get(d);

    for (const it of items) {
      const uid = String(it.Roster.user_id);
      const name = it.User?.name || "Onbekend";
      const h = hoursBetween(it.Roster.starttime, it.Roster.endtime);

      let rec = byUser.get(uid);
      if (!rec) {
        rec = { user_id: uid, name, shifts: 0, daysWorked: 0, hours: 0, cost: 0, missingWage: 0 };
        byUser.set(uid, rec);
      }

      rec.shifts += 1;
      rec.hours += h;
      if (!dayUsers.has(uid)) { rec.daysWorked += 1; dayUsers.add(uid); }

      const w = wageMap?.get(uid);
      if (typeof w === "number" && w > 0 && h > 0) {
        rec.cost += h * w; // wage is al inclusief opslag (API rekent dat nu erin)
      } else {
        rec.missingWage += 1; // signaleren
      }
    }
  }

  // 4) Resultaat opbouwen
  const users = Array.from(byUser.values()).sort((a, b) => a.name.localeCompare(b.name));
  const totals = users.reduce(
    (acc, u) => {
      acc.hours += u.hours;
      acc.cost += u.cost;
      acc.shifts += u.shifts;
      acc.daysWorked += u.daysWorked;
      acc.missingWage += u.missingWage;
      return acc;
    },
    { hours: 0, cost: 0, shifts: 0, daysWorked: 0, missingWage: 0 }
  );

  if (format === "csv") {
    const header = [
      "jaar",
      "maand",
      "user_id",
      "naam",
      "dagen",
      "shifts",
      "uren",
      "kosten_eur",
      "shifts_zonder_tarief",
    ].join(",");
    const rows = users.map((u) =>
      [
        jaar,
        maand,
        u.user_id,
        `"${u.name.replace(/"/g, '""')}"`,
        u.daysWorked,
        u.shifts,
        u.hours.toFixed(2),
        Math.round(u.cost),
        u.missingWage,
      ].join(",")
    );
    const csv = [header, ...rows, "", `TOTAAL,,,,${totals.daysWorked},${totals.shifts},${totals.hours.toFixed(2)},${Math.round(totals.cost)},${totals.missingWage}`].join("\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="kosten-${jaar}-${pad2(maand)}.csv"`,
      },
    });
  }

  return NextResponse.json(
    {
      jaar,
      maand,
      totals: {
        hours: Number(totals.hours.toFixed(2)),
        cost: Math.round(totals.cost),
        shifts: totals.shifts,
        daysWorked: totals.daysWorked,
        missingWage: totals.missingWage,
      },
      users: users.map((u) => ({
        user_id: u.user_id,
        name: u.name,
        daysWorked: u.daysWorked,
        shifts: u.shifts,
        hours: Number(u.hours.toFixed(2)),
        cost: Math.round(u.cost),
        missingWage: u.missingWage,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
