import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Shiftbase NAW (subset) – we gebruiken alleen wat we nodig hebben.
type NawUser = {
  User?: {
    id?: string | number;
    date_of_birth?: string | null;
    birth_date?: string | null;
    birthdate?: string | null;
    birthday?: string | null;
    dateOfBirth?: string | null;
  };
  // sommige tenants leveren direct vlakke keys:
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
  uurloon: string;
  geldig_van: string;        // "YYYY-MM-DD"
  geldig_tot: string | null; // of null
};

/**
 * GET /api/shiftbase/wages-by-age?min_date=YYYY-MM-DD&max_date=YYYY-MM-DD&user_ids=1,2,3
 * Retourneert: { data: { date, user_id, wage }[] }
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const minDate = url.searchParams.get("min_date");
  const maxDate = url.searchParams.get("max_date");
  const userIdsParam = url.searchParams.get("user_ids"); // optioneel, CSV

  if (!minDate || !maxDate) {
    return NextResponse.json(
      { error: "min_date en max_date zijn verplicht (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  // 1) NAW ophalen via jouw endpoint (en niet direct bij Shiftbase)
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
    ? new Set(
        userIdsParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    : null;

  // Map NAW → { user_id, dob } en filter (met expliciete type‑annotatie)
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

  // 2) Loonregels uit jouw tabel
  const regelsRes = await db.query(
    `SELECT min_leeftijd, max_leeftijd, uurloon, geldig_van, geldig_tot FROM loon_leeftijd`
  );
  const regels = (regelsRes as any).rows as LoonRegel[];

  // 3) Datumbereik
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

  for (const date of dates) {
    for (const u of users) {
      if (!u.dob) continue; // geen geboortedatum → geen loon
      const age = ageOn(u.dob, date);

      const match = regels
        .filter((r) => {
          const inAge = age >= r.min_leeftijd && age <= r.max_leeftijd;
          const inFrom = date >= r.geldig_van;
          const inTo = !r.geldig_tot || date <= r.geldig_tot;
          return inAge && inFrom && inTo;
        })
        .sort((a, b) => (a.geldig_van < b.geldig_van ? 1 : -1)); // meest recente eerst

      if (match.length) {
        const wageNum = parseFloat(match[0].uurloon);
        if (wageNum > 0) out.push({ date, user_id: u.user_id, wage: wageNum });
      }
    }
  }

  return NextResponse.json({ data: out });
}
