import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type NawUser = {
  User?: {
    id?: string | number;
    date_of_birth?: string | null;
    birth_date?: string | null;
    birthdate?: string | null;
    birthday?: string | null;
    dateOfBirth?: string | null;
  };
  id?: string | number;
  date_of_birth?: string | null;
  birth_date?: string | null;
  birthdate?: string | null;
  birthday?: string | null;
  dateOfBirth?: string | null;
};
type MappedUser = { user_id: string; dob?: string };

type LoonRegel = {
  min_leeftijd: number;
  max_leeftijd: number;
  uurloon: string;        // NUMERIC als string
  geldig_van: string;     // YYYY-MM-DD
  geldig_tot: string | null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const minDate = url.searchParams.get("min_date");
  const maxDate = url.searchParams.get("max_date");
  const userIdsParam = url.searchParams.get("user_ids"); // optioneel CSV

  if (!minDate || !maxDate) {
    return NextResponse.json(
      { error: "min_date en max_date zijn verplicht (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  // 1) NAW ophalen
  const nawRes = await fetch(`${url.origin}/api/shiftbase/naw`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!nawRes.ok) {
    const body = await nawRes.text();
    return NextResponse.json(
      { error: "Fout bij ophalen NAW", details: body },
      { status: nawRes.status }
    );
  }
  const nawJson = (await nawRes.json()) as { data?: NawUser[] };

  const allowSet: Set<string> | null = userIdsParam
    ? new Set(userIdsParam.split(",").map((s) => s.trim()).filter(Boolean))
    : null;

  const users: MappedUser[] = (nawJson?.data ?? [])
    .map((row: NawUser): MappedUser => {
      const u = row.User ?? row;
      const idStr = String(u?.id ?? "");
      const dobRaw =
        u?.date_of_birth ??
        u?.birth_date ??
        u?.birthdate ??
        u?.birthday ??
        u?.dateOfBirth;
      const dob = dobRaw ? String(dobRaw).slice(0, 10) : undefined;
      return { user_id: idStr, dob };
    })
    .filter((u: MappedUser) => u.user_id && (!allowSet || allowSet.has(u.user_id)));

  // 2) Loonregels
  const regelsRes = await db.query(
    `SELECT min_leeftijd, max_leeftijd, uurloon, geldig_van, geldig_tot FROM loon_leeftijd`
  );
  const regels = (regelsRes as any).rows as LoonRegel[];

  // 3) Datums
  const dates: string[] = [];
  {
    const start = new Date(minDate + "T12:00:00");
    const end = new Date(maxDate + "T12:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }
  }

  const ageOn = (birthISO: string, onISO: string) => {
    const b = new Date(birthISO);
    const o = new Date(onISO + "T12:00:00");
    let age = o.getFullYear() - b.getFullYear();
    const m = o.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && o.getDate() < b.getDate())) age--;
    return age;
  };

  const out: Array<{ date: string; user_id: string; wage: number }> = [];

  // 🔎 Debug-meta
  const meta = {
    users_total: users.length,
    users_without_dob: [] as string[],
    rules_total: regels.length,
    no_rule_match_per_date: {} as Record<string, string[]>, // date -> [user_id]
  };

  for (const date of dates) {
    for (const u of users) {
      if (!u.dob) {
        if (!meta.users_without_dob.includes(u.user_id)) meta.users_without_dob.push(u.user_id);
        continue;
      }
      const age = ageOn(u.dob, date);

      const match = regels
        .filter((r) => {
          const inAge = age >= r.min_leeftijd && age <= r.max_leeftijd;
          const inFrom = date >= r.geldig_van;
          const inTo = !r.geldig_tot || date <= r.geldig_tot;
          return inAge && inFrom && inTo;
        })
        .sort((a, b) => (a.geldig_van < b.geldig_van ? 1 : -1));

      if (match.length) {
        const wageNum = parseFloat(match[0].uurloon);
        if (wageNum > 0) out.push({ date, user_id: u.user_id, wage: wageNum });
      } else {
        if (!meta.no_rule_match_per_date[date]) meta.no_rule_match_per_date[date] = [];
        meta.no_rule_match_per_date[date].push(u.user_id);
      }
    }
  }

  return NextResponse.json({ data: out, meta });
}
