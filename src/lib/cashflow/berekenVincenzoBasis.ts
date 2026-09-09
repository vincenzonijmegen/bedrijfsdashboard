import { db } from "@/lib/db";

type MaandRegel = {
  maand: number;
  omzet: number;
  omzetBron: "werkelijk" | "prognose";
  loonkosten: number | null;
  loonkostenBron: "werkelijk" | "shiftbase" | "niet_beschikbaar";
  vasteUitgaven: number;
  vasteStromen: Array<{ naam: string; bedrag: number }>;
  nettoVoorOverigePosten: number | null;
};

type RosterItem = {
  Roster?: {
    starttime?: string;
    endtime?: string;
    user_id?: string | number;
  };
  User?: { id?: string | number; name?: string };
};

type ShiftbaseUser = {
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

type LadderRow = {
  min_leeftijd: number;
  max_leeftijd: number;
  uurloon: number;
  pensioen_opslag: number | null;
  geldig_van: string | null;
  geldig_tot: string | null;
};

const SEIZOEN_MAANDEN = [3, 4, 5, 6, 7, 8, 9];

function normalizePct(v: unknown): number {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n === 0) return 0;
  return n > 1.5 ? n / 100 : n;
}

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

function ageOn(birthISO: string, onISO: string) {
  const b = new Date(`${birthISO}T12:00:00`);
  const o = new Date(`${onISO}T12:00:00`);
  let a = o.getFullYear() - b.getFullYear();
  const md = o.getMonth() - b.getMonth();
  if (md < 0 || (md === 0 && o.getDate() < b.getDate())) a--;
  return a;
}

function hoursBetween(a: string, b: string) {
  const [sh, sm] = a.split(":").map(Number);
  const [eh, em] = b.split(":").map(Number);
  let minuten = eh * 60 + em - (sh * 60 + sm);
  if (minuten < 0) minuten += 1440;
  return minuten / 60;
}

async function getOmzetBasis(jaar: number, groeiPct: number) {
  const [vorigRes, pctRes, realRes] = await Promise.all([
    db.query(
      `SELECT COALESCE(SUM(aantal * eenheidsprijs), 0) AS totaal
       FROM rapportage.omzet
       WHERE EXTRACT(YEAR FROM datum)::int = $1`,
      [jaar - 1]
    ),
    db.query(`
      WITH bron AS (
        SELECT EXTRACT(YEAR FROM datum)::int AS yr,
               EXTRACT(MONTH FROM datum)::int AS m,
               (aantal * eenheidsprijs) AS omz
        FROM rapportage.omzet
        WHERE EXTRACT(YEAR FROM datum)::int BETWEEN 2022 AND 2024
          AND EXTRACT(MONTH FROM datum)::int BETWEEN 3 AND 9
      ), per_maand AS (
        SELECT yr, m, SUM(omz) AS omz FROM bron GROUP BY 1,2
      ), per_jaar AS (
        SELECT yr, SUM(omz) AS jaar_omz FROM per_maand GROUP BY 1
      )
      SELECT p.m,
             COALESCE(AVG(CASE WHEN j.jaar_omz > 0 THEN p.omz / j.jaar_omz ELSE 0 END), 0) AS pct
      FROM per_maand p
      JOIN per_jaar j ON j.yr = p.yr
      GROUP BY p.m
      ORDER BY p.m
    `),
    db.query(
      `SELECT EXTRACT(MONTH FROM datum)::int AS maand,
              COALESCE(SUM(aantal * eenheidsprijs), 0) AS totaal
       FROM rapportage.omzet
       WHERE EXTRACT(YEAR FROM datum)::int = $1
       GROUP BY 1
       ORDER BY 1`,
      [jaar]
    ),
  ]);

  const vorigJaar = Number(vorigRes.rows?.[0]?.totaal ?? 0);
  const jaarDoel = vorigJaar * (1 + groeiPct / 100);
  const pct = new Map<number, number>();
  for (const r of pctRes.rows ?? []) pct.set(Number(r.m), Number(r.pct) || 0);
  const werkelijk = new Map<number, number>();
  for (const r of realRes.rows ?? []) werkelijk.set(Number(r.maand), Number(r.totaal) || 0);

  return { jaarDoel, pct, werkelijk };
}

async function getWerkelijkeLoonkosten(jaar: number) {
  const res = await db.query(
    `SELECT maand,
            COALESCE(lonen,0) + COALESCE(loonheffing,0) + COALESCE(pensioenpremie,0) AS totaal
     FROM rapportage.loonkosten
     WHERE jaar = $1
     ORDER BY maand`,
    [jaar]
  );
  const map = new Map<number, number>();
  for (const r of res.rows ?? []) map.set(Number(r.maand), Number(r.totaal) || 0);
  return map;
}

async function getLadder(): Promise<LadderRow[]> {
  const res = await db.query(`
    SELECT min_leeftijd, max_leeftijd, uurloon,
           CASE WHEN EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='loon_leeftijd' AND column_name='pensioen_opslag'
           ) THEN pensioen_opslag ELSE NULL END AS pensioen_opslag,
           geldig_van::text AS geldig_van,
           geldig_tot::text AS geldig_tot
    FROM loon_leeftijd
    ORDER BY min_leeftijd
  `);
  return (res.rows ?? []).map((r: any) => ({
    min_leeftijd: Number(r.min_leeftijd),
    max_leeftijd: Number(r.max_leeftijd),
    uurloon: Number(r.uurloon),
    pensioen_opslag: r.pensioen_opslag == null ? null : Number(r.pensioen_opslag),
    geldig_van: r.geldig_van ?? null,
    geldig_tot: r.geldig_tot ?? null,
  }));
}

async function getGeneriekeOpslag(): Promise<number> {
  try {
    const res = await db.query(`
      SELECT COALESCE(SUM(percentage),0) AS som
      FROM loon_opslagen
      WHERE actief
        AND (geldig_van IS NULL OR CURRENT_DATE >= geldig_van)
        AND (geldig_tot IS NULL OR CURRENT_DATE <= geldig_tot)
    `);
    const n = normalizePct(res.rows?.[0]?.som);
    if (n > 0) return n;
  } catch {
    // bestaande fallback uit wages-by-age
  }
  return [0.1064, 0.0885, 0.0010, 0.0700, 0.0622, 0.0077, 0.0050, 0.0083, 0.0657, 0.0025]
    .reduce((a, b) => a + b, 0);
}

async function getShiftbaseMaandkosten(jaar: number, maand: number): Promise<number | null> {
  const apiKey = process.env.SHIFTBASE_API_KEY?.trim();
  if (!apiKey) return null;

  const minDate = isoDate(jaar, maand, 1);
  const maxDate = isoDate(jaar, maand, daysInMonth(jaar, maand));
  const headers = { Authorization: `API ${apiKey}`, Accept: "application/json" };

  try {
    const rosterUrl = new URL("https://api.shiftbase.com/api/rosters");
    rosterUrl.searchParams.set("min_date", minDate);
    rosterUrl.searchParams.set("max_date", maxDate);

    const [rosterRes, usersRes, ladder, generiekeOpslag] = await Promise.all([
      fetch(rosterUrl.toString(), { headers, cache: "no-store" }),
      fetch("https://api.shiftbase.com/api/users", { headers, cache: "no-store" }),
      getLadder(),
      getGeneriekeOpslag(),
    ]);

    if (!rosterRes.ok || !usersRes.ok) return null;

    const rosterJson = await rosterRes.json();
    const usersJson = await usersRes.json();
    const roster: RosterItem[] = Array.isArray(rosterJson) ? rosterJson : (rosterJson?.data ?? []);
    const usersRaw: ShiftbaseUser[] = Array.isArray(usersJson) ? usersJson : (usersJson?.data ?? []);

    const dobByUser = new Map<string, string>();
    for (const row of usersRaw) {
      const u: any = row.User ?? row;
      const id = String(u?.id ?? "");
      const dobRaw = u?.date_of_birth ?? u?.birth_date ?? u?.birthdate ?? u?.birthday ?? u?.dateOfBirth;
      if (id && dobRaw) dobByUser.set(id, String(dobRaw).slice(0, 10));
    }

    let totaal = 0;
    for (const item of roster) {
      const r = item.Roster;
      const uid = String(r?.user_id ?? item.User?.id ?? "");
      if (!uid || !r?.starttime || !r?.endtime) continue;

      const dob = dobByUser.get(uid);
      if (!dob) continue;

      const datumRaw = (item as any)?.Roster?.date ?? (item as any)?.date ?? (item as any)?.Roster?.startdate;
      const shiftDate = datumRaw ? String(datumRaw).slice(0, 10) : minDate;
      const leeftijd = ageOn(dob, shiftDate);
      const row = ladder.find((x) => {
        if (leeftijd < x.min_leeftijd || leeftijd > x.max_leeftijd) return false;
        if (x.geldig_van && shiftDate < x.geldig_van.slice(0, 10)) return false;
        if (x.geldig_tot && shiftDate > x.geldig_tot.slice(0, 10)) return false;
        return true;
      });
      if (!row || row.uurloon <= 0) continue;

      const pensioen = leeftijd >= 18 ? normalizePct(row.pensioen_opslag) : 0;
      const uurkosten = row.uurloon * (1 + generiekeOpslag + pensioen);
      totaal += hoursBetween(r.starttime, r.endtime) * uurkosten;
    }

    return Math.round(totaal * 100) / 100;
  } catch {
    return null;
  }
}

async function getVasteUitgaven(jaar: number) {
  const entRes = await db.query(
    `SELECT id FROM cashflow_entiteiten WHERE naam='IJssalon Vincenzo B.V.' LIMIT 1`
  );
  const entiteitId = Number(entRes.rows?.[0]?.id);
  if (!entiteitId) throw new Error("IJssalon Vincenzo B.V. ontbreekt in cashflow_entiteiten");

  // Laat PostgreSQL zelf de datumgeldigheid bepalen. Dat voorkomt verschillen
  // in DATE-parsing tussen Node/pg-omgevingen en maakt de tariefhistorie leidend.
  const res = await db.query(`
    WITH maanden AS (
      SELECT generate_series(
        make_date($2, 1, 1),
        make_date($2, 12, 1),
        interval '1 month'
      )::date AS maand_datum
    )
    SELECT
      EXTRACT(MONTH FROM m.maand_datum)::int AS maand,
      s.naam,
      b.bedrag
    FROM maanden m
    JOIN cashflow_stromen s
      ON s.van_entiteit_id = $1
     AND s.actief = true
     AND s.gedrag = 'vast'
     AND s.frequentie = 'maandelijks'
     AND m.maand_datum >= s.startdatum
     AND (s.einddatum IS NULL OR m.maand_datum <= s.einddatum)
    JOIN cashflow_stroom_bedragen b
      ON b.stroom_id = s.id
     AND b.bedrag IS NOT NULL
     AND m.maand_datum >= b.geldig_vanaf
     AND (b.geldig_tot IS NULL OR m.maand_datum <= b.geldig_tot)
    ORDER BY maand, s.naam
  `, [entiteitId, jaar]);

  const perMaand = new Map<number, Array<{ naam: string; bedrag: number }>>();
  for (let maand = 1; maand <= 12; maand++) perMaand.set(maand, []);

  for (const r of res.rows ?? []) {
    const maand = Number(r.maand);
    if (!Number.isInteger(maand) || maand < 1 || maand > 12) continue;
    perMaand.get(maand)!.push({
      naam: String(r.naam),
      bedrag: Number(r.bedrag) || 0,
    });
  }

  return perMaand;
}

export async function berekenVincenzoBasis(jaar: number): Promise<{
  jaar: number;
  groeiPct: number;
  waarschuwingen: string[];
  maanden: MaandRegel[];
}> {
  const huidigJaar = new Date().getFullYear();
  if (jaar !== huidigJaar) {
    throw new Error(`Fase 4A ondersteunt voorlopig alleen het huidige jaar (${huidigJaar})`);
  }

  const instellingRes = await db.query(`
    SELECT COALESCE(i.prognosegroei_pct, 0) AS groei
    FROM cashflow_entiteiten e
    LEFT JOIN cashflow_instellingen i ON i.entiteit_id=e.id
    WHERE e.naam='IJssalon Vincenzo B.V.'
    LIMIT 1
  `);
  const groeiPct = Number(instellingRes.rows?.[0]?.groei ?? 0);

  const [omzet, werkelijkeLonen, vasteUitgaven] = await Promise.all([
    getOmzetBasis(jaar, groeiPct),
    getWerkelijkeLoonkosten(jaar),
    getVasteUitgaven(jaar),
  ]);

  const now = new Date();
  const huidigeMaand = now.getMonth() + 1;
  const waarschuwingen: string[] = [];
  const maanden: MaandRegel[] = [];

  for (let maand = 1; maand <= 12; maand++) {
    const werkelijkOmzet = omzet.werkelijk.get(maand) ?? 0;
    const doel = SEIZOEN_MAANDEN.includes(maand)
      ? omzet.jaarDoel * (omzet.pct.get(maand) ?? 0)
      : 0;

    const omzetIsWerkelijk = maand < huidigeMaand;
    const omzetBedrag = omzetIsWerkelijk ? werkelijkOmzet : Math.max(werkelijkOmzet, doel);

    let loonkosten: number | null;
    let loonkostenBron: MaandRegel["loonkostenBron"];
    if (maand < huidigeMaand && werkelijkeLonen.has(maand)) {
      loonkosten = werkelijkeLonen.get(maand)!;
      loonkostenBron = "werkelijk";
    } else {
      loonkosten = await getShiftbaseMaandkosten(jaar, maand);
      loonkostenBron = loonkosten === null ? "niet_beschikbaar" : "shiftbase";
      if (loonkosten === null && maand >= huidigeMaand && SEIZOEN_MAANDEN.includes(maand)) {
        waarschuwingen.push(`Loonkosten ${jaar}-${String(maand).padStart(2, "0")} konden niet uit Shiftbase worden berekend.`);
      }
    }

    const vasteStromen = vasteUitgaven.get(maand) ?? [];
    const vasteTotaal = vasteStromen.reduce((s, r) => s + r.bedrag, 0);
    maanden.push({
      maand,
      omzet: Math.round(omzetBedrag * 100) / 100,
      omzetBron: omzetIsWerkelijk ? "werkelijk" : "prognose",
      loonkosten,
      loonkostenBron,
      vasteUitgaven: Math.round(vasteTotaal * 100) / 100,
      vasteStromen,
      nettoVoorOverigePosten: loonkosten === null
        ? null
        : Math.round((omzetBedrag - loonkosten - vasteTotaal) * 100) / 100,
    });
  }

  return { jaar, groeiPct, waarschuwingen, maanden };
}
