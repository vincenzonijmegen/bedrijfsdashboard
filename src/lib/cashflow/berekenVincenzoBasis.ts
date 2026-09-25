import { db } from "@/lib/db";
import { berekenVincenzoNaarHoldingUitkeringen } from "@/lib/cashflow/berekenHoldingsMeerjaren";

type VasteStroomRegel = {
  naam: string;
  bedrag: number;
  btwPercentage: number;
  btwAftrekbaarPercentage: number;
  bedragIsInclusiefBtw: boolean;
};

type IncidentelePost = {
  datum: string;
  omschrijving: string;
  bedrag: number;
  richting: "in" | "uit";
  categorie: string;
  tegenpartijNaam: string | null;
  btwPercentage: number;
  btwAftrekbaarPercentage: number;
  bedragIsInclusiefBtw: boolean;
  status: string;
};

type MaandRegel = {
  maand: number;
  omzet: number;
  omzetBron: "werkelijk" | "prognose";
  loonkosten: number | null;
  loonkostenBron: "werkelijk" | "shiftbase" | "niet_beschikbaar";
  vasteUitgaven: number;
  vasteStromen: VasteStroomRegel[];
  inkoop: number | null;
  inkoopBron: "bank_basis" | "bank_profiel_omzetgeschaald" | "geen_profiel" | "niet_beschikbaar";
  btwKasMutatie: number;
  overigeUitgaven: number;
  overigeBron: "bank_basis" | "geen_profiel";
  incidenteleInkomsten: number;
  incidenteleUitgaven: number;
  aflossingSchuldHoldings: number;
  dividendNaarHoldings: number;
  incidentelePosten: IncidentelePost[];
  nettoVoorOverigePosten: number | null;
  nettoNaInkoopEnBtw: number | null;
  nettoNaOverigeUitgaven: number | null;
  nettoNaIncidenteel: number | null;
};

type InkoopProfiel = {
  maand: number;
  basisjaar: number;
  basisKasuitstroom: number;
  basisOmzet: number;
  schaalwijze: "omzet" | "vast";
  btwPercentage: number;
  btwAftrekbaarPercentage: number;
};

type OverigeProfiel = {
  maand: number;
  basisjaar: number;
  basisKasuitstroom: number;
};

type BtwKwartaalRegel = {
  kwartaal: number;
  omzetInclBtw: number;
  btwOmzet9: number;
  voorbelasting9: number;
  voorbelasting21: number;
  voorbelastingOverig: number;
  modelAfdracht: number;
  werkelijkeAfdracht: number | null;
  gebruikteAfdracht: number;
  bron: "werkelijk" | "prognose";
  betaaldatum: string;
  afwijkingModelWerkelijk: number | null;
};

type CashflowRekeningStart = {
  id: number;
  naam: string;
  rekeningType: string;
  startsaldo: number | null;
  peildatum: string | null;
};

type CashflowSaldoMaand = {
  maand: number;
  beginsaldo: number;
  kasmutatie: number;
  eindsaldo: number;
  minimumKasbuffer: number | null;
  bufferVerschil: number | null;
  onderMinimum: boolean;
};

type CashPositie = {
  beschikbaar: boolean;
  reden: string | null;
  peildatum: string | null;
  startsaldoTotaal: number | null;
  minimumKasbuffer: number | null;
  rekeningen: CashflowRekeningStart[];
  maanden: CashflowSaldoMaand[];
  laagsteSaldo: number | null;
  laagsteMaand: number | null;
  eindsaldo: number | null;
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
    // Zelfde historische maandverdeling als /api/prognose/verdeling:
    // alle volledig afgesloten jaren vanaf 2022.
    db.query(`
      WITH geldige_jaren AS (
        SELECT DISTINCT EXTRACT(YEAR FROM datum)::int AS jaar
        FROM rapportage.omzet
        WHERE datum >= '2022-01-01'
          AND EXTRACT(YEAR FROM datum)::int < EXTRACT(YEAR FROM CURRENT_DATE)::int
      ),
      maandomzet AS (
        SELECT
          EXTRACT(YEAR FROM datum)::int AS jaar,
          EXTRACT(MONTH FROM datum)::int AS maand,
          SUM(aantal * eenheidsprijs) AS omzet_maand
        FROM rapportage.omzet
        WHERE EXTRACT(YEAR FROM datum)::int IN (SELECT jaar FROM geldige_jaren)
        GROUP BY 1, 2
      ),
      jaaromzet AS (
        SELECT
          jaar,
          SUM(omzet_maand) AS omzet_jaar
        FROM maandomzet
        GROUP BY jaar
      ),
      verdeling AS (
        SELECT
          m.jaar,
          m.maand,
          ROUND((m.omzet_maand / j.omzet_jaar)::numeric, 5) AS maand_percentage
        FROM maandomzet m
        JOIN jaaromzet j ON m.jaar = j.jaar
      )
      SELECT
        v.maand,
        ROUND(AVG(v.maand_percentage)::numeric, 5) AS percentage,
        COUNT(DISTINCT v.jaar)::int AS aantal_jaren
      FROM verdeling v
      GROUP BY v.maand
      ORDER BY v.maand
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

  const pctRuw = new Map<number, number>();
  let aantalHistorischeJaren = 0;
  for (const r of pctRes.rows ?? []) {
    pctRuw.set(Number(r.maand), Number(r.percentage) || 0);
    aantalHistorischeJaren = Math.max(
      aantalHistorischeJaren,
      Number(r.aantal_jaren) || 0
    );
  }

  // De cashflow rekent het reguliere seizoen maart-september.
  // Normaliseer de door /api/prognose/verdeling geleverde historische
  // percentages binnen die zeven maanden, zodat het volledige jaarbudget
  // over het seizoen wordt verdeeld.
  const seizoenSom = SEIZOEN_MAANDEN.reduce(
    (som, maand) => som + (pctRuw.get(maand) ?? 0),
    0
  );
  const pct = new Map<number, number>();
  for (const maand of SEIZOEN_MAANDEN) {
    pct.set(
      maand,
      seizoenSom > 0
        ? (pctRuw.get(maand) ?? 0) / seizoenSom
        : 1 / SEIZOEN_MAANDEN.length
    );
  }

  const werkelijk = new Map<number, number>();
  for (const r of realRes.rows ?? []) werkelijk.set(Number(r.maand), Number(r.totaal) || 0);

  return {
    jaarDoel,
    pct,
    werkelijk,
    aantalHistorischeJaren,
  };
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

async function getVincenzoEntiteitId() {
  const entRes = await db.query(
    `SELECT id FROM cashflow_entiteiten WHERE naam='IJssalon Vincenzo B.V.' LIMIT 1`
  );
  const entiteitId = Number(entRes.rows?.[0]?.id);
  if (!entiteitId) throw new Error("IJssalon Vincenzo B.V. ontbreekt in cashflow_entiteiten");
  return entiteitId;
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function btwUitBedrag(
  bedrag: number,
  btwPercentage: number,
  aftrekbaarPercentage: number,
  inclusiefBtw: boolean
) {
  if (bedrag <= 0 || btwPercentage <= 0 || aftrekbaarPercentage <= 0) return 0;
  const btw = inclusiefBtw
    ? bedrag - bedrag / (1 + btwPercentage / 100)
    : bedrag * (btwPercentage / 100);
  return round2(btw * (aftrekbaarPercentage / 100));
}

function naarKasBedrag(bedrag: number, btwPercentage: number, inclusiefBtw: boolean) {
  if (inclusiefBtw || btwPercentage <= 0) return round2(bedrag);
  return round2(bedrag * (1 + btwPercentage / 100));
}

async function getVasteUitgaven(jaar: number, entiteitId: number) {
  // Vaste maandstromen blijven leidend vanuit de tariefhistorie.
  // Voor planbare + uitstelbare stromen wordt een handmatige planning uit
  // cashflow_planning toegepast: de oorspronkelijke maand vervalt en dezelfde
  // betaling verschijnt in de geplande maand.
  const res = await db.query(`
    WITH maanden AS (
      SELECT generate_series(
        make_date($2 - 1, 1, 1),
        make_date($2, 12, 1),
        interval '1 month'
      )::date AS maand_datum
    )
    SELECT
      EXTRACT(YEAR FROM m.maand_datum)::int AS jaar,
      EXTRACT(MONTH FROM m.maand_datum)::int AS maand,
      to_char(m.maand_datum, 'YYYY-MM-DD') AS oorspronkelijke_datum,
      s.id AS stroom_id,
      s.naam,
      s.gedrag,
      s.uitstelbaar,
      b.bedrag,
      b.btw_percentage,
      b.btw_aftrekbaar_percentage,
      b.bedrag_is_inclusief_btw
    FROM maanden m
    JOIN cashflow_stromen s
      ON s.van_entiteit_id = $1
     AND s.actief = true
     AND s.gedrag IN ('vast', 'planbaar')
     AND s.frequentie = 'maandelijks'
     AND m.maand_datum >= s.startdatum
     AND (s.einddatum IS NULL OR m.maand_datum <= s.einddatum)
    JOIN cashflow_stroom_bedragen b
      ON b.stroom_id = s.id
     AND b.bedrag IS NOT NULL
     AND b.percentage_van_bron IS NULL
     AND m.maand_datum >= b.geldig_vanaf
     AND (b.geldig_tot IS NULL OR m.maand_datum <= b.geldig_tot)
    ORDER BY m.maand_datum, s.naam
  `, [entiteitId, jaar]);

  const rows = res.rows ?? [];
  const streamIds = Array.from(
    new Set(
      rows
        .filter((r: any) => String(r.gedrag) === "planbaar" && Boolean(r.uitstelbaar))
        .map((r: any) => Number(r.stroom_id))
        .filter((id: number) => Number.isInteger(id))
    )
  );

  const plans = new Map<string, {
    plannedDate: string;
    amount: number;
    status: string;
    paidOn: string | null;
  }>();

  if (streamIds.length) {
    const planRes = await db.query(`
      SELECT
        stroom_id,
        oorspronkelijke_datum::text AS oorspronkelijke_datum,
        geplande_datum::text AS geplande_datum,
        bedrag,
        status,
        betaald_op::text AS betaald_op
      FROM cashflow_planning
      WHERE stroom_id = ANY($1::int[])
        AND (
          EXTRACT(YEAR FROM oorspronkelijke_datum)::int BETWEEN $2 - 1 AND $2
          OR EXTRACT(YEAR FROM geplande_datum)::int = $2
          OR EXTRACT(YEAR FROM betaald_op)::int = $2
        )
      ORDER BY stroom_id, oorspronkelijke_datum
    `, [streamIds, jaar]);

    for (const p of planRes.rows ?? []) {
      const originalDate = String(p.oorspronkelijke_datum).slice(0, 10);
      plans.set(`${Number(p.stroom_id)}|${originalDate}`, {
        plannedDate: String(p.geplande_datum).slice(0, 10),
        amount: Number(p.bedrag) || 0,
        status: String(p.status),
        paidOn: p.betaald_op == null ? null : String(p.betaald_op).slice(0, 10),
      });
    }
  }

  const perMaand = new Map<number, VasteStroomRegel[]>();
  for (let maand = 1; maand <= 12; maand++) perMaand.set(maand, []);

  for (const r of rows) {
    const streamId = Number(r.stroom_id);
    const originalDate = String(r.oorspronkelijke_datum).slice(0, 10);
    const planbaar = String(r.gedrag) === "planbaar" && Boolean(r.uitstelbaar);
    const plan = planbaar ? plans.get(`${streamId}|${originalDate}`) : undefined;

    if (plan?.status === "vervallen") continue;

    const actualDate =
      plan?.status === "betaald" && plan.paidOn
        ? plan.paidOn
        : plan?.plannedDate ?? originalDate;

    if (Number(actualDate.slice(0, 4)) !== jaar) continue;

    const maand = Number(actualDate.slice(5, 7));
    if (!Number.isInteger(maand) || maand < 1 || maand > 12) continue;

    const opgeslagenBedrag = plan ? plan.amount : Number(r.bedrag) || 0;
    const btwPercentage = Number(r.btw_percentage) || 0;
    const bedragIsInclusiefBtw = r.bedrag_is_inclusief_btw !== false;

    perMaand.get(maand)!.push({
      naam: String(r.naam),
      bedrag: naarKasBedrag(opgeslagenBedrag, btwPercentage, bedragIsInclusiefBtw),
      btwPercentage,
      btwAftrekbaarPercentage: Number(r.btw_aftrekbaar_percentage) || 0,
      bedragIsInclusiefBtw,
    });
  }

  for (const items of perMaand.values()) {
    items.sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
  }

  return perMaand;
}

async function getInkoopProfielen(entiteitId: number): Promise<Map<number, InkoopProfiel>> {
  const res = await db.query(`
    SELECT
      p.maand,
      p.basisjaar,
      p.basis_kasuitstroom,
      p.schaalwijze,
      p.btw_percentage,
      p.btw_aftrekbaar_percentage,
      COALESCE(SUM(o.aantal * o.eenheidsprijs), 0) AS basis_omzet
    FROM cashflow_inkoopprofiel p
    LEFT JOIN rapportage.omzet o
      ON EXTRACT(YEAR FROM o.datum)::int = p.basisjaar
     AND EXTRACT(MONTH FROM o.datum)::int = p.maand
    WHERE p.entiteit_id = $1
      AND p.actief = true
    GROUP BY p.id, p.maand, p.basisjaar, p.basis_kasuitstroom,
             p.schaalwijze, p.btw_percentage, p.btw_aftrekbaar_percentage
    ORDER BY p.maand
  `, [entiteitId]);

  const map = new Map<number, InkoopProfiel>();
  for (const r of res.rows ?? []) {
    map.set(Number(r.maand), {
      maand: Number(r.maand),
      basisjaar: Number(r.basisjaar),
      basisKasuitstroom: Number(r.basis_kasuitstroom) || 0,
      basisOmzet: Number(r.basis_omzet) || 0,
      schaalwijze: r.schaalwijze === "vast" ? "vast" : "omzet",
      btwPercentage: Number(r.btw_percentage) || 0,
      btwAftrekbaarPercentage: Number(r.btw_aftrekbaar_percentage) || 0,
    });
  }
  return map;
}

function berekenInkoop(
  profiel: InkoopProfiel | undefined,
  jaar: number,
  maand: number,
  omzetBedrag: number,
  afgeslotenTotMaand: number
): { bedrag: number | null; bron: MaandRegel["inkoopBron"] } {
  if (!profiel) return { bedrag: 0, bron: "geen_profiel" };
  if (profiel.schaalwijze === "vast") {
    return { bedrag: round2(profiel.basisKasuitstroom), bron: "bank_basis" };
  }

  // De actieve saldopeildatum bepaalt welke maanden afgesloten zijn.
  // Voor die maanden is de werkelijke bankuitstroom leidend; pas daarna
  // schalen we het historische kaspatroon mee met de omzetprognose.
  if (jaar === profiel.basisjaar && maand <= afgeslotenTotMaand) {
    return { bedrag: round2(profiel.basisKasuitstroom), bron: "bank_basis" };
  }
  if (profiel.basisOmzet <= 0) {
    return { bedrag: null, bron: "niet_beschikbaar" };
  }
  return {
    bedrag: round2(profiel.basisKasuitstroom * (omzetBedrag / profiel.basisOmzet)),
    bron: "bank_profiel_omzetgeschaald",
  };
}

async function getOverigeProfielen(entiteitId: number): Promise<Map<number, OverigeProfiel>> {
  const res = await db.query(`
    SELECT maand, basisjaar, basis_kasuitstroom
    FROM cashflow_overige_profiel
    WHERE entiteit_id = $1
      AND actief = true
    ORDER BY maand
  `, [entiteitId]);

  const map = new Map<number, OverigeProfiel>();
  for (const r of res.rows ?? []) {
    map.set(Number(r.maand), {
      maand: Number(r.maand),
      basisjaar: Number(r.basisjaar),
      basisKasuitstroom: Number(r.basis_kasuitstroom) || 0,
    });
  }
  return map;
}

function berekenOverige(
  profiel: OverigeProfiel | undefined
): { bedrag: number; bron: MaandRegel["overigeBron"] } {
  if (!profiel) return { bedrag: 0, bron: "geen_profiel" };
  return { bedrag: round2(profiel.basisKasuitstroom), bron: "bank_basis" };
}

async function getIncidentelePosten(entiteitId: number, jaar: number): Promise<Map<number, IncidentelePost[]>> {
  const res = await db.query(`
    SELECT
      datum::text AS datum,
      omschrijving,
      bedrag,
      richting,
      categorie,
      tegenpartij_naam,
      btw_percentage,
      btw_aftrekbaar_percentage,
      bedrag_is_inclusief_btw,
      status
    FROM cashflow_incidenteel
    WHERE entiteit_id = $1
      AND EXTRACT(YEAR FROM datum)::int = $2
      AND status <> 'vervallen'
    ORDER BY datum, id
  `, [entiteitId, jaar]);

  const map = new Map<number, IncidentelePost[]>();
  for (let maand = 1; maand <= 12; maand++) map.set(maand, []);

  for (const r of res.rows ?? []) {
    const datum = String(r.datum).slice(0, 10);
    const maand = Number(datum.slice(5, 7));
    if (!Number.isInteger(maand) || maand < 1 || maand > 12) continue;
    map.get(maand)!.push({
      datum,
      omschrijving: String(r.omschrijving),
      bedrag: Number(r.bedrag) || 0,
      richting: r.richting === 'in' ? 'in' : 'uit',
      categorie: String(r.categorie),
      tegenpartijNaam: r.tegenpartij_naam == null ? null : String(r.tegenpartij_naam),
      btwPercentage: Number(r.btw_percentage) || 0,
      btwAftrekbaarPercentage: Number(r.btw_aftrekbaar_percentage) || 0,
      bedragIsInclusiefBtw: r.bedrag_is_inclusief_btw !== false,
      status: String(r.status),
    });
  }

  return map;
}

async function getCashflowStartgegevens(entiteitId: number): Promise<{
  rekeningen: CashflowRekeningStart[];
  minimumKasbuffer: number | null;
}> {
  const [rekeningRes, instellingRes] = await Promise.all([
    db.query(`
      SELECT id, naam, rekening_type, prognose_startsaldo, saldo_peildatum::text AS saldo_peildatum
      FROM cashflow_rekeningen
      WHERE entiteit_id = $1
        AND actief = true
      ORDER BY naam
    `, [entiteitId]),
    db.query(`
      SELECT minimum_kasbuffer
      FROM cashflow_instellingen
      WHERE entiteit_id = $1
      LIMIT 1
    `, [entiteitId]),
  ]);

  return {
    rekeningen: (rekeningRes.rows ?? []).map((r: any) => ({
      id: Number(r.id),
      naam: String(r.naam),
      rekeningType: String(r.rekening_type),
      startsaldo: r.prognose_startsaldo == null ? null : Number(r.prognose_startsaldo),
      peildatum: r.saldo_peildatum ? String(r.saldo_peildatum).slice(0, 10) : null,
    })),
    minimumKasbuffer: instellingRes.rows?.[0]?.minimum_kasbuffer == null
      ? null
      : Number(instellingRes.rows[0].minimum_kasbuffer),
  };
}

function parseIsoDate(iso: string): { jaar: number; maand: number; dag: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const jaar = Number(m[1]);
  const maand = Number(m[2]);
  const dag = Number(m[3]);
  if (!Number.isInteger(jaar) || maand < 1 || maand > 12 || dag < 1 || dag > daysInMonth(jaar, maand)) return null;
  return { jaar, maand, dag };
}

function berekenCashPositie(
  jaar: number,
  maanden: MaandRegel[],
  rekeningen: CashflowRekeningStart[],
  minimumKasbuffer: number | null
): CashPositie {
  const basis: Omit<CashPositie, "beschikbaar" | "reden" | "peildatum" | "startsaldoTotaal" | "maanden" | "laagsteSaldo" | "laagsteMaand" | "eindsaldo"> = {
    minimumKasbuffer,
    rekeningen,
  };

  if (rekeningen.length === 0) {
    return { beschikbaar: false, reden: "Geen actieve rekeningen gevonden", peildatum: null, startsaldoTotaal: null, maanden: [], laagsteSaldo: null, laagsteMaand: null, eindsaldo: null, ...basis };
  }

  const ontbrekend = rekeningen.filter((r) => r.startsaldo === null || r.peildatum === null);
  if (ontbrekend.length > 0) {
    return {
      beschikbaar: false,
      reden: `Startsaldo/peildatum ontbreekt voor: ${ontbrekend.map((r) => r.naam).join(", ")}`,
      peildatum: null,
      startsaldoTotaal: null,
      maanden: [],
      laagsteSaldo: null,
      laagsteMaand: null,
      eindsaldo: null,
      ...basis,
    };
  }

  const peildata = [...new Set(rekeningen.map((r) => r.peildatum!))];
  if (peildata.length !== 1) {
    return {
      beschikbaar: false,
      reden: "Alle actieve rekeningen moeten dezelfde peildatum hebben",
      peildatum: null,
      startsaldoTotaal: null,
      maanden: [],
      laagsteSaldo: null,
      laagsteMaand: null,
      eindsaldo: null,
      ...basis,
    };
  }

  const peildatum = peildata[0];
  const parsed = parseIsoDate(peildatum);
  if (!parsed) {
    return { beschikbaar: false, reden: "Ongeldige peildatum", peildatum, startsaldoTotaal: null, maanden: [], laagsteSaldo: null, laagsteMaand: null, eindsaldo: null, ...basis };
  }
  if (parsed.dag !== daysInMonth(parsed.jaar, parsed.maand)) {
    return {
      beschikbaar: false,
      reden: "Fase 4D vereist een maandultimo als gezamenlijke peildatum",
      peildatum,
      startsaldoTotaal: null,
      maanden: [],
      laagsteSaldo: null,
      laagsteMaand: null,
      eindsaldo: null,
      ...basis,
    };
  }

  let eersteMaand: number;
  if (parsed.jaar === jaar) {
    eersteMaand = parsed.maand + 1;
  } else if (parsed.jaar === jaar - 1 && parsed.maand === 12) {
    eersteMaand = 1;
  } else {
    return {
      beschikbaar: false,
      reden: `Peildatum ${peildatum} kan niet veilig naar prognosejaar ${jaar} worden doorgerold`,
      peildatum,
      startsaldoTotaal: null,
      maanden: [],
      laagsteSaldo: null,
      laagsteMaand: null,
      eindsaldo: null,
      ...basis,
    };
  }

  const startsaldoTotaal = round2(rekeningen.reduce((som, r) => som + (r.startsaldo ?? 0), 0));
  let saldo = startsaldoTotaal;
  const saldoMaanden: CashflowSaldoMaand[] = [];

  for (let maand = eersteMaand; maand <= 12; maand++) {
    const regel = maanden.find((m) => m.maand === maand);
    if (!regel || regel.nettoNaIncidenteel === null) {
      return {
        beschikbaar: false,
        reden: `Kasmutatie voor ${jaar}-${String(maand).padStart(2, "0")} is niet volledig beschikbaar`,
        peildatum,
        startsaldoTotaal,
        maanden: saldoMaanden,
        laagsteSaldo: saldoMaanden.length ? Math.min(...saldoMaanden.map((m) => m.eindsaldo)) : startsaldoTotaal,
        laagsteMaand: saldoMaanden.length ? saldoMaanden.reduce((a, b) => b.eindsaldo < a.eindsaldo ? b : a).maand : null,
        eindsaldo: saldo,
        ...basis,
      };
    }

    const beginsaldo = saldo;
    const kasmutatie = regel.nettoNaIncidenteel;
    saldo = round2(beginsaldo + kasmutatie);
    const bufferVerschil = minimumKasbuffer === null ? null : round2(saldo - minimumKasbuffer);
    saldoMaanden.push({
      maand,
      beginsaldo: round2(beginsaldo),
      kasmutatie: round2(kasmutatie),
      eindsaldo: saldo,
      minimumKasbuffer,
      bufferVerschil,
      onderMinimum: minimumKasbuffer !== null && saldo < minimumKasbuffer,
    });
  }

  const laagsteRegel = saldoMaanden.length
    ? saldoMaanden.reduce((a, b) => b.eindsaldo < a.eindsaldo ? b : a)
    : null;

  return {
    beschikbaar: true,
    reden: null,
    peildatum,
    startsaldoTotaal,
    minimumKasbuffer,
    rekeningen,
    maanden: saldoMaanden,
    laagsteSaldo: laagsteRegel?.eindsaldo ?? startsaldoTotaal,
    laagsteMaand: laagsteRegel?.maand ?? null,
    eindsaldo: saldoMaanden.length ? saldoMaanden[saldoMaanden.length - 1].eindsaldo : startsaldoTotaal,
  };
}

function standaardBtwBetaaldatum(jaar: number, kwartaal: number) {
  if (kwartaal === 1) return `${jaar}-04-30`;
  if (kwartaal === 2) return `${jaar}-07-31`;
  if (kwartaal === 3) return `${jaar}-10-31`;
  return `${jaar + 1}-01-31`;
}

async function getWerkelijkeBtwRows(entiteitId: number, jaar: number) {
  const res = await db.query(`
    SELECT jaar, kwartaal, werkelijke_afdracht,
           geplande_betaaldatum::text AS geplande_betaaldatum,
           werkelijke_betaaldatum::text AS werkelijke_betaaldatum,
           status
    FROM cashflow_btw_kwartalen
    WHERE entiteit_id = $1
      AND (
        jaar = $2
        OR EXTRACT(YEAR FROM werkelijke_betaaldatum)::int = $2
      )
    ORDER BY jaar, kwartaal
  `, [entiteitId, jaar]);
  return res.rows ?? [];
}

export async function berekenVincenzoBasis(jaar: number): Promise<{
  jaar: number;
  groeiPct: number;
  omzetModel: {
    bron: "api_prognose_verdeling";
    historischeJaren: number;
    jaarDoel: number;
    verdeling: Array<{ maand: number; percentage: number }>;
  };
  prognoseGrens: {
    peildatum: string | null;
    afgeslotenTotMaand: number;
    eerstePrognoseMaand: number | null;
  };
  waarschuwingen: string[];
  maanden: MaandRegel[];
  btwKwartalen: BtwKwartaalRegel[];
  cashPositie: CashPositie;
}> {
  const huidigJaar = new Date().getFullYear();
  if (jaar !== huidigJaar) {
    throw new Error(`Fase 4E ondersteunt voorlopig alleen het huidige jaar (${huidigJaar})`);
  }

  const entiteitId = await getVincenzoEntiteitId();
  const instellingRes = await db.query(`
    SELECT COALESCE(i.prognosegroei_pct, 0) AS groei
    FROM cashflow_entiteiten e
    LEFT JOIN cashflow_instellingen i ON i.entiteit_id=e.id
    WHERE e.id=$1
    LIMIT 1
  `, [entiteitId]);
  const groeiPct = Number(instellingRes.rows?.[0]?.groei ?? 0);

  const [omzet, werkelijkeLonen, vasteUitgaven, inkoopProfielen, overigeProfielen, incidenteleProfielen, btwRows, cashStart, vincenzoHoldingUitkeringen] = await Promise.all([
    getOmzetBasis(jaar, groeiPct),
    getWerkelijkeLoonkosten(jaar),
    getVasteUitgaven(jaar, entiteitId),
    getInkoopProfielen(entiteitId),
    getOverigeProfielen(entiteitId),
    getIncidentelePosten(entiteitId, jaar),
    getWerkelijkeBtwRows(entiteitId, jaar),
    getCashflowStartgegevens(entiteitId),
    berekenVincenzoNaarHoldingUitkeringen(jaar),
  ]);

  const peildata = [...new Set(
    cashStart.rekeningen
      .map((rekening) => rekening.peildatum)
      .filter((datum): datum is string => Boolean(datum))
  )];

  let afgeslotenTotMaand = 0;
  let actievePeildatum: string | null = null;
  if (peildata.length === 1) {
    actievePeildatum = peildata[0];
    const parsed = parseIsoDate(actievePeildatum);
    if (
      parsed &&
      parsed.jaar === jaar &&
      parsed.dag === daysInMonth(parsed.jaar, parsed.maand)
    ) {
      afgeslotenTotMaand = parsed.maand;
    } else if (
      parsed &&
      parsed.jaar === jaar - 1 &&
      parsed.maand === 12 &&
      parsed.dag === 31
    ) {
      afgeslotenTotMaand = 0;
    }
  }

  const eerstePrognoseMaand = Math.min(13, afgeslotenTotMaand + 1);
  const waarschuwingen: string[] = [
    "Overige reguliere/losse ING-uitgaven zitten in de kasprognose, maar hun BTW wordt nog niet als voorbelasting geraamd omdat de bankexport geen betrouwbaar 9%/21%-onderscheid bevat.",
    "Bekende grotere eenmalige of tijdgebonden posten worden apart via cashflow_incidenteel verwerkt; er geldt geen kunstmatige grens van €1.000 meer voor het overige maandprofiel.",
  ];
  if (actievePeildatum === null || peildata.length !== 1) {
    waarschuwingen.push(
      "Werkelijkheid/prognosegrens kon niet uit één gezamenlijke saldopeildatum worden bepaald."
    );
  }
  const maanden: MaandRegel[] = [];

  type MaandBtw = {
    maand: number;
    omzet: number;
    btwOmzet: number;
    voorbelasting9: number;
    voorbelasting21: number;
  };
  const btwPerMaand: MaandBtw[] = [];

  for (let maand = 1; maand <= 12; maand++) {
    const werkelijkOmzet = omzet.werkelijk.get(maand) ?? 0;
    const doel = SEIZOEN_MAANDEN.includes(maand)
      ? omzet.jaarDoel * (omzet.pct.get(maand) ?? 0)
      : 0;

    const omzetIsWerkelijk = maand <= afgeslotenTotMaand;
    const omzetBedrag = omzetIsWerkelijk
      ? werkelijkOmzet
      : Math.max(werkelijkOmzet, doel);

    let loonkosten: number | null;
    let loonkostenBron: MaandRegel["loonkostenBron"];
    if (maand <= afgeslotenTotMaand && werkelijkeLonen.has(maand)) {
      loonkosten = werkelijkeLonen.get(maand)!;
      loonkostenBron = "werkelijk";
    } else {
      loonkosten = await getShiftbaseMaandkosten(jaar, maand);
      loonkostenBron = loonkosten === null ? "niet_beschikbaar" : "shiftbase";
      if (loonkosten === null && maand > afgeslotenTotMaand && SEIZOEN_MAANDEN.includes(maand)) {
        waarschuwingen.push(`Loonkosten ${jaar}-${String(maand).padStart(2, "0")} konden niet uit Shiftbase worden berekend.`);
      }
    }

    const vasteStromen = vasteUitgaven.get(maand) ?? [];
    const vasteTotaal = round2(vasteStromen.reduce((som, r) => som + r.bedrag, 0));

    const inkoopResultaat = berekenInkoop(
      inkoopProfielen.get(maand),
      jaar,
      maand,
      omzetBedrag,
      afgeslotenTotMaand
    );
    const inkoop = inkoopResultaat.bedrag;
    if (inkoop === null) {
      waarschuwingen.push(`Productinkoop ${jaar}-${String(maand).padStart(2, "0")} kon niet uit het bankprofiel worden berekend.`);
    }

    const overigeResultaat = berekenOverige(overigeProfielen.get(maand));
    const overigeUitgaven = overigeResultaat.bedrag;

    const incidentelePosten = incidenteleProfielen.get(maand) ?? [];
    const incidenteleInkomsten = round2(incidentelePosten
      .filter((p) => p.richting === "in")
      .reduce((som, p) => som + p.bedrag, 0));
    const incidenteleUitgaven = round2(incidentelePosten
      .filter((p) => p.richting === "uit")
      .reduce((som, p) => som + p.bedrag, 0));
    const aflossingSchuldHoldings = round2(
      vincenzoHoldingUitkeringen
        .filter(
          (p) =>
            p.kind === "vrije_ruimte" &&
            p.year === jaar &&
            p.month === maand
        )
        .reduce((som, p) => som + p.amount, 0)
    );
    const dividendNaarHoldings = round2(
      vincenzoHoldingUitkeringen
        .filter(
          (p) =>
            p.kind === "dividend" &&
            p.year === jaar &&
            p.month === maand
        )
        .reduce((som, p) => som + p.amount, 0)
    );

    let btwOmzet = round2(omzetBedrag * 9 / 109);

    // Incidentele ontvangsten kunnen ook BTW bevatten. Het bedrag in
    // cashflow_incidenteel is een kasbedrag; daarom telt alleen het BTW-deel
    // mee als extra output-BTW.
    for (const post of incidentelePosten.filter((p) => p.richting === "in")) {
      btwOmzet = round2(
        btwOmzet +
          btwUitBedrag(
            post.bedrag,
            post.btwPercentage,
            100,
            post.bedragIsInclusiefBtw
          )
      );
    }

    let voorbelasting9 = 0;
    let voorbelasting21 = 0;

    const profiel = inkoopProfielen.get(maand);
    if (inkoop !== null && profiel && profiel.btwPercentage > 0) {
      const inkoopBtw = btwUitBedrag(
        inkoop,
        profiel.btwPercentage,
        profiel.btwAftrekbaarPercentage,
        true
      );
      if (Math.abs(profiel.btwPercentage - 9) < 0.001) voorbelasting9 += inkoopBtw;
      else if (Math.abs(profiel.btwPercentage - 21) < 0.001) voorbelasting21 += inkoopBtw;
    }

    for (const stroom of vasteStromen) {
      const aftrek = btwUitBedrag(
        stroom.bedrag,
        stroom.btwPercentage,
        stroom.btwAftrekbaarPercentage,
        true
      );
      if (Math.abs(stroom.btwPercentage - 9) < 0.001) voorbelasting9 += aftrek;
      else if (Math.abs(stroom.btwPercentage - 21) < 0.001) voorbelasting21 += aftrek;
    }

    for (const post of incidentelePosten.filter((p) => p.richting === "uit")) {
      const aftrek = btwUitBedrag(
        post.bedrag,
        post.btwPercentage,
        post.btwAftrekbaarPercentage,
        post.bedragIsInclusiefBtw
      );
      if (Math.abs(post.btwPercentage - 9) < 0.001) voorbelasting9 += aftrek;
      else if (Math.abs(post.btwPercentage - 21) < 0.001) voorbelasting21 += aftrek;
    }

    btwPerMaand.push({
      maand,
      omzet: round2(omzetBedrag),
      btwOmzet,
      voorbelasting9: round2(voorbelasting9),
      voorbelasting21: round2(voorbelasting21),
    });

    const nettoVoorOverigePosten = loonkosten === null
      ? null
      : round2(omzetBedrag - loonkosten - vasteTotaal);

    maanden.push({
      maand,
      omzet: round2(omzetBedrag),
      omzetBron: omzetIsWerkelijk ? "werkelijk" : "prognose",
      loonkosten,
      loonkostenBron,
      vasteUitgaven: vasteTotaal,
      vasteStromen,
      inkoop,
      inkoopBron: inkoopResultaat.bron,
      btwKasMutatie: 0,
      overigeUitgaven,
      overigeBron: overigeResultaat.bron,
      incidenteleInkomsten,
      incidenteleUitgaven,
      aflossingSchuldHoldings,
      dividendNaarHoldings,
      incidentelePosten,
      nettoVoorOverigePosten,
      nettoNaInkoopEnBtw: nettoVoorOverigePosten === null || inkoop === null
        ? null
        : round2(nettoVoorOverigePosten - inkoop),
      nettoNaOverigeUitgaven: nettoVoorOverigePosten === null || inkoop === null
        ? null
        : round2(nettoVoorOverigePosten - inkoop - overigeUitgaven),
      nettoNaIncidenteel: nettoVoorOverigePosten === null || inkoop === null
        ? null
        : round2(
            nettoVoorOverigePosten
            - inkoop
            - overigeUitgaven
            - incidenteleUitgaven
            - aflossingSchuldHoldings
            - dividendNaarHoldings
            + incidenteleInkomsten
          ),
    });
  }

  const werkelijkMap = new Map<string, any>();
  for (const row of btwRows) {
    werkelijkMap.set(`${Number(row.jaar)}-${Number(row.kwartaal)}`, row);
  }

  const btwKwartalen: BtwKwartaalRegel[] = [];
  for (let kwartaal = 1; kwartaal <= 4; kwartaal++) {
    const van = (kwartaal - 1) * 3 + 1;
    const regels = btwPerMaand.filter((r) => r.maand >= van && r.maand <= van + 2);
    const omzetInclBtw = round2(regels.reduce((s, r) => s + r.omzet, 0));
    const btwOmzet9 = round2(regels.reduce((s, r) => s + r.btwOmzet, 0));
    const voorbelasting9 = round2(regels.reduce((s, r) => s + r.voorbelasting9, 0));
    const voorbelasting21 = round2(regels.reduce((s, r) => s + r.voorbelasting21, 0));
    const voorbelastingOverig = 0;
    const modelAfdracht = round2(
      btwOmzet9 - voorbelasting9 - voorbelasting21 - voorbelastingOverig
    );

    const actual = werkelijkMap.get(`${jaar}-${kwartaal}`);
    const heeftWerkelijk = actual?.status === "betaald" && actual?.werkelijke_afdracht != null;
    const werkelijkeAfdracht = heeftWerkelijk ? Number(actual.werkelijke_afdracht) : null;
    const gebruikteAfdracht = round2(heeftWerkelijk ? werkelijkeAfdracht! : modelAfdracht);
    const betaaldatum = String(
      (heeftWerkelijk ? actual.werkelijke_betaaldatum : actual?.geplande_betaaldatum)
      ?? standaardBtwBetaaldatum(jaar, kwartaal)
    ).slice(0, 10);

    btwKwartalen.push({
      kwartaal,
      omzetInclBtw,
      btwOmzet9,
      voorbelasting9,
      voorbelasting21,
      voorbelastingOverig,
      modelAfdracht,
      werkelijkeAfdracht,
      gebruikteAfdracht,
      bron: heeftWerkelijk ? "werkelijk" : "prognose",
      betaaldatum,
      afwijkingModelWerkelijk: heeftWerkelijk
        ? round2(werkelijkeAfdracht! - modelAfdracht)
        : null,
    });
  }

  // Kasmutaties uit de vier kwartalen van dit jaar.
  for (const kwartaal of btwKwartalen) {
    const d = new Date(`${kwartaal.betaaldatum}T12:00:00`);
    if (d.getFullYear() !== jaar) continue;
    const maand = d.getMonth() + 1;
    const regel = maanden.find((m) => m.maand === maand);
    if (!regel) continue;
    regel.btwKasMutatie = round2(regel.btwKasMutatie - kwartaal.gebruikteAfdracht);
  }

  // Ook een teruggaaf/afdracht uit het voorgaande kwartaaljaar kan in dit
  // kalenderjaar op de bank landen (zoals Q4 2025 in februari 2026).
  for (const row of btwRows) {
    const rowJaar = Number(row.jaar);
    if (rowJaar === jaar || row?.status !== "betaald" || row?.werkelijke_afdracht == null) continue;
    const betaaldatum = String(row.werkelijke_betaaldatum ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(betaaldatum)) continue;
    const d = new Date(`${betaaldatum}T12:00:00`);
    if (d.getFullYear() !== jaar) continue;
    const regel = maanden.find((m) => m.maand === d.getMonth() + 1);
    if (!regel) continue;
    regel.btwKasMutatie = round2(regel.btwKasMutatie - Number(row.werkelijke_afdracht));
  }

  for (const regel of maanden) {
    if (regel.nettoNaInkoopEnBtw !== null) {
      regel.nettoNaInkoopEnBtw = round2(regel.nettoNaInkoopEnBtw + regel.btwKasMutatie);
    }
    if (regel.nettoNaOverigeUitgaven !== null) {
      regel.nettoNaOverigeUitgaven = round2(regel.nettoNaOverigeUitgaven + regel.btwKasMutatie);
    }
    if (regel.nettoNaIncidenteel !== null) {
      regel.nettoNaIncidenteel = round2(regel.nettoNaIncidenteel + regel.btwKasMutatie);
    }
  }

  const cashPositie = berekenCashPositie(
    jaar,
    maanden,
    cashStart.rekeningen,
    cashStart.minimumKasbuffer
  );

  if (!cashPositie.beschikbaar && cashPositie.reden) {
    waarschuwingen.push(`Kaspositie niet berekend: ${cashPositie.reden}.`);
  } else if (cashPositie.minimumKasbuffer !== null) {
    for (const m of cashPositie.maanden.filter((x) => x.onderMinimum)) {
      waarschuwingen.push(
        `Kasbuffer onder minimum in ${jaar}-${String(m.maand).padStart(2, "0")}: ` +
        `eindsaldo €${m.eindsaldo.toFixed(2)}, minimum €${cashPositie.minimumKasbuffer.toFixed(2)}.`
      );
    }
  }

  return {
    jaar,
    groeiPct,
    omzetModel: {
      bron: "api_prognose_verdeling",
      historischeJaren: omzet.aantalHistorischeJaren,
      jaarDoel: round2(omzet.jaarDoel),
      verdeling: SEIZOEN_MAANDEN.map((maand) => ({
        maand,
        percentage: Number((omzet.pct.get(maand) ?? 0).toFixed(8)),
      })),
    },
    prognoseGrens: {
      peildatum: actievePeildatum,
      afgeslotenTotMaand,
      eerstePrognoseMaand:
        eerstePrognoseMaand <= 12 ? eerstePrognoseMaand : null,
    },
    waarschuwingen,
    maanden,
    btwKwartalen,
    cashPositie,
  };
}
