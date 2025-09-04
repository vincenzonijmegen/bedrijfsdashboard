// src/app/api/shiftbase/wages-by-age/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** -------------------------------
 * Helpers (datum & leeftijd)
 * ------------------------------- */
function isIsoDate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
function rangeDays(minDate: string, maxDate: string) {
  const out: string[] = [];
  const start = new Date(minDate + "T12:00:00");
  const end = new Date(maxDate + "T12:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1))
    out.push(d.toISOString().slice(0, 10));
  return out;
}
function ageOn(birthISO: string, onISO: string) {
  const b = new Date(birthISO), o = new Date(onISO + "T12:00:00");
  let a = o.getFullYear() - b.getFullYear();
  const m = o.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && o.getDate() < b.getDate())) a--;
  return a;
}
function normalizePct(v: number | null | undefined): number {
  if (v == null || !isFinite(v as number)) return 0;
  const num = Number(v);
  if (num === 0) return 0;
  // Als iemand 8 of 17 heeft ingevuld bedoelt die vaak 8% / 17%
  return num > 1.5 ? num / 100 : num; // fractie teruggeven
}

/** -------------------------------
 * Data access
 * ------------------------------- */

// Bruto uurloon-ladder uit DB (optioneel met pensioen_opslag)
type LadderRow = {
  min_leeftijd: number;
  max_leeftijd: number;
  uurloon: number;
  geldig_van?: string | null;
  geldig_tot?: string | null;
  pensioen_opslag?: number | null; // optioneel: fractie of percentage
};

async function getLadderFromDB(): Promise<LadderRow[]> {
  // pensioen_opslag is optioneel; selecteren we 'm, en als de kolom niet bestaat, laten we 'm gewoon wegvallen
  const res = await db.query(`
    SELECT min_leeftijd, max_leeftijd, uurloon,
           CASE WHEN to_regclass('loon_leeftijd'::text) IS NOT NULL
                AND EXISTS (
                  SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'loon_leeftijd' AND column_name = 'pensioen_opslag'
                )
             THEN pensioen_opslag
             ELSE NULL
           END AS pensioen_opslag,
           COALESCE(NULLIF(geldig_van::text,''), NULL) AS geldig_van,
           COALESCE(NULLIF(geldig_tot::text,''), NULL) AS geldig_tot
    FROM loon_leeftijd
    ORDER BY min_leeftijd ASC
  `);
  const rows = (res as any).rows as any[];
  return rows.map(r => ({
    min_leeftijd: Number(r.min_leeftijd),
    max_leeftijd: Number(r.max_leeftijd),
    uurloon: Number(r.uurloon),
    geldig_van: r.geldig_van ?? null,
    geldig_tot: r.geldig_tot ?? null,
    pensioen_opslag: r.pensioen_opslag != null ? Number(r.pensioen_opslag) : null,
  }));
}

// Som generieke opslagen uit tabel loon_opslagen (actief & binnen geldigheid)
async function getGeneriekeOpslagSomFromDB(): Promise<number> {
  try {
    const res = await db.query(`
      SELECT COALESCE(SUM(percentage),0) AS som
      FROM loon_opslagen
      WHERE actief
        AND (geldig_van IS NULL OR CURRENT_DATE >= geldig_van)
        AND (geldig_tot IS NULL OR CURRENT_DATE <= geldig_tot)
    `);
    const som = Number((res as any).rows?.[0]?.som ?? 0);
    return normalizePct(som); // som kan al fractie zijn; normalize de zekerheid
  } catch {
    return 0;
  }
}

// Fallback generieke opslagen (jouw lijst) als de DB-tabel er nog niet is
function getGeneriekeOpslagSomFallback(): number {
  const FRACTIES = [
    0.1064, // Vakantieuren 10,64%
    0.0885, // Vakantiegeld 8,85%
    0.0010, // HOP-premie 0,1%
    0.0700, // WW-premie 7%
    0.0622, // Aof 6,22%
    0.0077, // Whk 0,77%
    0.0050, // Zw-flex 0,5%
    0.0083, // WGA 0,83%
    0.0657, // wg ZVW 6,57%
    0.0025, // overhead 0,25%
  ];
  return FRACTIES.reduce((s, v) => s + v, 0);
}

async function getGeneriekeOpslagSom(): Promise<number> {
  const fromDB = await getGeneriekeOpslagSomFromDB();
  if (fromDB > 0) return fromDB;
  return getGeneriekeOpslagSomFallback();
}

/** -------------------------------
 * Shiftbase NAW → DOB
 * ------------------------------- */
type NawUser = {
  User?: { id?: string | number; date_of_birth?: string | null; birth_date?: string | null; birthdate?: string | null; birthday?: string | null; dateOfBirth?: string | null; };
  id?: string | number;
  date_of_birth?: string | null; birth_date?: string | null; birthdate?: string | null; birthday?: string | null; dateOfBirth?: string | null;
};
type MappedUser = { user_id: string; dob?: string };

async function getUsersWithDob(origin: string, allowSet: Set<string> | null) {
  const nawRes = await fetch(`${origin}/api/shiftbase/naw`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!nawRes.ok) {
    const body = await nawRes.text();
    throw new Error(`Fout bij ophalen NAW: ${body}`);
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
  return users;
}

/** -------------------------------
 * GET
 * ------------------------------- */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const minDate = url.searchParams.get("min_date") ?? "";
  const maxDate = url.searchParams.get("max_date") ?? "";
  const userIdsParam = url.searchParams.get("user_ids"); // CSV van ingeplande users
  const debug = url.searchParams.get("debug") === "1";

  if (!isIsoDate(minDate) || !isIsoDate(maxDate) || minDate > maxDate) {
    return NextResponse.json({ error: "min_date/max_date ongeldig (YYYY-MM-DD) of min > max" }, { status: 400 });
  }

  // 0) Ingesloten users filter
  const allowSet: Set<string> | null = userIdsParam
    ? new Set(userIdsParam.split(",").map(s => s.trim()).filter(Boolean))
    : null;

  // 1) Ladder en generieke opslagen ophalen
  const [ladder, genSom] = await Promise.all([
    getLadderFromDB(),
    getGeneriekeOpslagSom(),
  ]);

  // 2) DOBs
  let users: MappedUser[] = [];
  try {
    users = await getUsersWithDob(url.origin, allowSet);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Fout bij ophalen NAW" }, { status: 500 });
  }

  // 3) Ranges & matches
  const dates = rangeDays(minDate, maxDate);
  const out: Array<{ date: string; user_id: string; wage: number } & any> = [];
  const meta = {
    ladder_rows: ladder.length,
    generieke_opslag_som: genSom,
    users_total: users.length,
    users_without_dob: [] as string[],
    no_ladder_match_per_date: {} as Record<string, string[]>,
    users_with_wage_per_date: {} as Record<string, string[]>,
    pensioen_vanaf_leeftijd: 18,
  };

  // Vind ladderregel voor leeftijd
  const findLadderRow = (age: number) =>
    ladder.find(x => age >= x.min_leeftijd && age <= x.max_leeftijd) ?? null;

  for (const date of dates) {
    const noMatch: string[] = [];
    const withWage: string[] = [];

    for (const u of users) {
      if (!u.dob) { 
        if (!meta.users_without_dob.includes(u.user_id)) meta.users_without_dob.push(u.user_id);
        continue; 
      }

      const age = ageOn(u.dob, date);
      const row = findLadderRow(age);

      if (row && row.uurloon > 0) {
        const brutoUurloon = Number(row.uurloon) || 0;

        // Pensioen alleen bij leeftijd >= 18 (percentage kan per ladderregel worden beheerd)
        const pensioenPct = age >= 18 ? normalizePct(row.pensioen_opslag) : 0;

        // Eindfactor = 1 + som_generiek + pensioenPct
        const factorEind = 1 + genSom + pensioenPct;

        const wageIncl = brutoUurloon * factorEind;

        const rec: any = { date, user_id: u.user_id, wage: wageIncl };
        if (debug) {
          rec.wage_raw = brutoUurloon;
          rec.factor_eind = factorEind;
          rec.gen_opslag = genSom;
          rec.pensioen_pct = pensioenPct;
          rec.leeftijd = age;
        }
        out.push(rec);
        withWage.push(u.user_id);
      } else {
        noMatch.push(u.user_id);
      }
    }

    if (withWage.length) meta.users_with_wage_per_date[date] = withWage;
    if (noMatch.length) meta.no_ladder_match_per_date[date] = noMatch;
  }

  return NextResponse.json({ data: out, meta }, { headers: { "Cache-Control": "no-store" } });
}
