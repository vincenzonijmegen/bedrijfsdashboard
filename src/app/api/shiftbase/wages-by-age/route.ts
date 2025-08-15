// src/app/api/shiftbase/wages-by-age/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";       // ✅ forceer Node.js (pg support)
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/shiftbase/wages-by-age?min_date=YYYY-MM-DD&max_date=YYYY-MM-DD
 * Berekent uurloon per user per dag o.b.v.:
 *  - Shiftbase users (NAW) voor geboortedatum
 *  - Tabel loon_leeftijd (min/max_leeftijd, uurloon, geldig_van/tot)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const minDate = url.searchParams.get("min_date");
  const maxDate = url.searchParams.get("max_date");

  if (!minDate || !maxDate) {
    return NextResponse.json(
      { error: "min_date en max_date zijn verplicht (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  const apiKey = process.env.SHIFTBASE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "SHIFTBASE_API_KEY ontbreekt" },
      { status: 500 }
    );
  }

  // 1) Haal gebruikers (incl. geboortedatum) uit jouw bestaande NAW endpoint
  //    (je wilde alleen jouw NAW + loon_leeftijd gebruiken)
  const nawRes = await fetch(`${url.origin}/api/shiftbase/naw`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!nawRes.ok) {
    const body = await nawRes.text();
    return NextResponse.json(
      { error: "Fout bij ophalen NAW", details: body },
      { status: nawRes.status }
    );
  }

  const nawJson: any = await nawRes.json();
  const users: Array<{ user_id: string; dob?: string }> = (nawJson?.data ?? [])
    .map((row: any) => {
      const u = row?.User ?? row?.user ?? row;
      const dob = u?.date_of_birth || u?.birthdate || u?.birthday;
      return { user_id: String(u?.id ?? ""), dob: dob ? String(dob).slice(0, 10) : undefined };
    })
    .filter((u: any) => u.user_id);

  // 2) Haal loonregels uit jouw tabel
type LoonRegel = {
  min_leeftijd: number;
  max_leeftijd: number;
  uurloon: string;           // NUMERIC komt als string binnen
  geldig_van: string;        // "YYYY-MM-DD"
  geldig_tot: string | null; // of null
};

const regelsRes = await db.query(
  `SELECT min_leeftijd, max_leeftijd, uurloon, geldig_van, geldig_tot FROM loon_leeftijd`
);
const regels: LoonRegel[] = (regelsRes as any).rows as LoonRegel[];

  // 3) Bouw datums tussen min..max
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
      if (!u.dob) continue;
      const age = ageOn(u.dob, date);

      // Kies loonregel die op 'date' geldt en leeftijd dekt (meest recente geldig_van wint)
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
      }
    }
  }

  return NextResponse.json({ data: out });
}
