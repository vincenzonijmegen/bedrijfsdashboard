// src/app/api/shiftbase/wages-by-age/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Fallback ladder (alleen gebruikt als DB leeg is)
const FALLBACK = [
  { min_leeftijd: 14, max_leeftijd: 15, uurloon: 100.00, opslag: 0 },
  { min_leeftijd: 16, max_leeftijd: 16, uurloon: 100.00, opslag: 0 },
  { min_leeftijd: 17, max_leeftijd: 17, uurloon: 100.00, opslag: 0 },
  { min_leeftijd: 18, max_leeftijd: 18, uurloon: 100.00, opslag: 0 },
  { min_leeftijd: 19, max_leeftijd: 19, uurloon: 100.00, opslag: 0 },
  { min_leeftijd: 20, max_leeftijd: 20, uurloon: 100.00, opslag: 0 },
  { min_leeftijd: 21, max_leeftijd: 99, uurloon: 100.00, opslag: 0 },
];

type NawUser = {
  User?: { id?: string | number; date_of_birth?: string | null; birth_date?: string | null; birthdate?: string | null; birthday?: string | null; dateOfBirth?: string | null; };
  id?: string | number;
  date_of_birth?: string | null; birth_date?: string | null; birthdate?: string | null; birthday?: string | null; dateOfBirth?: string | null;
};
type MappedUser = { user_id: string; dob?: string };

function isIsoDate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
function rangeDays(minDate: string, maxDate: string) {
  const out: string[] = [];
  const start = new Date(minDate + "T12:00:00");
  const end = new Date(maxDate + "T12:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}
function ageOn(birthISO: string, onISO: string) {
  const b = new Date(birthISO), o = new Date(onISO + "T12:00:00");
  let a = o.getFullYear() - b.getFullYear();
  const m = o.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && o.getDate() < b.getDate())) a--;
  return a;
}

async function getLadderFromDB() {
  const res = await db.query(
    `SELECT min_leeftijd, max_leeftijd, uurloon, opslag, geldig_van, geldig_tot
     FROM loon_leeftijd
     ORDER BY geldig_van DESC, min_leeftijd ASC`
  );
  const rows = (res as any).rows as { 
    min_leeftijd: number; 
    max_leeftijd: number; 
    uurloon: string; 
    opslag?: string | null;
    geldig_van: string; 
    geldig_tot: string | null; 
  }[];
  return rows;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const minDate = url.searchParams.get("min_date") ?? "";
  const maxDate = url.searchParams.get("max_date") ?? "";
  const userIdsParam = url.searchParams.get("user_ids"); // CSV van ingeplande users
  const source = url.searchParams.get("source"); // optioneel: "db" | "fallback"

  if (!isIsoDate(minDate) || !isIsoDate(maxDate) || minDate > maxDate) {
    return NextResponse.json({ error: "min_date/max_date ongeldig (YYYY-MM-DD) of min > max" }, { status: 400 });
  }

  // Ladder kiezen: DB eerst (tenzij source=fallback)
  let ladder: { min_leeftijd: number; max_leeftijd: number; uurloon: number; opslag: number }[] = [];
  let ladderSource: "db" | "fallback" = "fallback";
  try {
    if (source !== "fallback") {
      const rows = await getLadderFromDB();
      if (rows.length > 0) {
        ladder = rows.map(r => ({
          min_leeftijd: r.min_leeftijd,
          max_leeftijd: r.max_leeftijd,
          uurloon: parseFloat(r.uurloon),
          opslag: r.opslag != null ? parseFloat(r.opslag as string) : 0,
        }));
        ladderSource = "db";
      }
    }
  } catch {
    // bij DB-fout val stilzwijgend terug op fallback
  }
  if (ladder.length === 0) ladder = FALLBACK;

  const allowSet: Set<string> | null = userIdsParam
    ? new Set(userIdsParam.split(",").map(s => s.trim()).filter(Boolean))
    : null;

  // NAW ophalen (DOB)
  const nawRes = await fetch(`${url.origin}/api/shiftbase/naw`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!nawRes.ok) {
    const body = await nawRes.text();
    return NextResponse.json({ error: "Fout bij ophalen NAW", details: body }, { status: nawRes.status });
  }
  const nawJson = (await nawRes.json()) as { data?: NawUser[] };

  const users: MappedUser[] = (nawJson?.data ?? [])
    .map((row: NawUser): MappedUser => {
      const u = row.User ?? row;
      const id = String(u?.id ?? "");
      const dobRaw = u?.date_of_birth ?? u?.birth_date ?? u?.birthdate ?? u?.birthday ?? u?.dateOfBirth;
      const dob = dobRaw ? String(dobRaw).slice(0, 10) : undefined;
      return { user_id: id, dob };
    })
    .filter(u => u.user_id && (!allowSet || allowSet.has(u.user_id)));

  const dates = rangeDays(minDate, maxDate);
  const out: Array<{ date: string; user_id: string; wage: number }> = [];

  const meta = {
    ladder_source: ladderSource,
    ladder_rows: ladder.length,
    ladder_min: Math.min(...ladder.map(x => x.min_leeftijd)),
    ladder_max: Math.max(...ladder.map(x => x.max_leeftijd)),
    users_total: users.length,
    users_without_dob: [] as string[],
    no_ladder_match_per_date: {} as Record<string, string[]>,
    users_with_wage_per_date: {} as Record<string, string[]>,
  };

  const wageForAge = (age: number) => ladder.find(x => age >= x.min_leeftijd && age <= x.max_leeftijd) ?? null;

  for (const date of dates) {
    const noMatch: string[] = [];
    const withWage: string[] = [];
    for (const u of users) {
      if (!u.dob) { 
        if (!meta.users_without_dob.includes(u.user_id)) meta.users_without_dob.push(u.user_id); 
        continue; 
      }
      const age = ageOn(u.dob, date);
      const row = wageForAge(age);
      if (row && row.uurloon > 0) { 
        const opslagPct = row.opslag ?? 0;
        const opslagFactor = 1 + (opslagPct / 100);
        const loonMetOpslag = row.uurloon * opslagFactor;

        out.push({ date, user_id: u.user_id, wage: loonMetOpslag }); 
        withWage.push(u.user_id); 
      }
      else { noMatch.push(u.user_id); }
    }
    if (withWage.length) meta.users_with_wage_per_date[date] = withWage;
    if (noMatch.length) meta.no_ladder_match_per_date[date] = noMatch;
  }

  return NextResponse.json({ data: out, meta }, { headers: { "Cache-Control": "no-store" } });
}
