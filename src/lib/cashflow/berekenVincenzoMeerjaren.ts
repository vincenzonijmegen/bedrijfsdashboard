import { db } from "@/lib/db";
import { berekenVincenzoBasis } from "@/lib/cashflow/berekenVincenzoBasis";
import { berekenVincenzoNaarHoldingUitkeringen } from "@/lib/cashflow/berekenHoldingsMeerjaren";

const SEIZOEN_MAANDEN = [3, 4, 5, 6, 7, 8, 9];

// 4Q-A — zelflerende loonkostenprognose.
// Alleen afgesloten maanden met werkelijke omzet én werkelijke loonkosten
// leren het percentage. De huidige, nog open maand mag Shiftbase blijven
// gebruiken; toekomstige jaren gebruiken het geleerde omzetpercentage.
const MANAGER_DAGEN_PER_WEEK = 3.5;
const MANAGER_UREN_PER_DAG = 13;
const MANAGER_PRODUCTIEF_PCT = 50;
const MANAGER_VERVANGING_PCT = 75;
const WEKEN_PER_MAAND = 52 / 12;
const WERKGEVERSLASTEN_PCT = 30;
const ROBERT_FULLTIME_VAN_JAAR = 2027;
const EMO_FULLTIME_VAN_JAAR = 2028;
const MANAGER_CORRECTIE_MAANDEN = [3, 4, 5, 6, 7, 8, 9];

const BESPAARDE_UREN_PER_MANAGER_PER_MAAND =
  MANAGER_DAGEN_PER_WEEK *
  MANAGER_UREN_PER_DAG *
  (MANAGER_PRODUCTIEF_PCT / 100) *
  (MANAGER_VERVANGING_PCT / 100) *
  WEKEN_PER_MAAND;

// 4O-A — VPB-planningsaannames.
// Voor toekomstige jaren houden we de actuele 2026-tarieven constant als
// planningsaanname. In 4O-A wordt de VPB alleen berekend en zichtbaar gemaakt;
// er is nog GEEN kasmutatie, zodat we de fiscale basis eerst in productie kunnen
// controleren voordat betaalmomenten het saldo beïnvloeden.
const VPB_TARIEF_BRONJAAR = 2026;
const VPB_DREMPEL = 200_000;
const VPB_LAAG_PCT = 19;
const VPB_HOOG_PCT = 25.8;
const VPB_BETAALMAAND_VOLGEND_JAAR = 8;

// De ruisende inbreng is voor de prognose gekoppeld aan 1 april 2026.
// Daardoor rekenen we voor het eerste BV-jaar alleen april t/m december mee
// in de VPB-planning. Vanaf 2027 geldt gewoon het volledige kalenderjaar.
const VPB_EERSTE_BV_JAAR = 2026;
const VPB_EERSTE_BV_MAAND = 4;

// 4R-A — fiscale referentie voor de winstprognose.
// De kasstroommotor is geen winst-en-verliesrekening. Voor VPB gebruiken we
// daarom de laatst afgesloten fiscale jaarrekening als winstgevendheidsanker
// en corrigeren we alleen voor de nieuwe managementfees en de expliciet
// gemodelleerde managerbesparing.
const VPB_REFERENTIE_JAAR = 2025;
const VPB_REFERENTIE_OPBRENGSTEN = 659_118;
const VPB_REFERENTIE_WINST = 219_322;
const VPB_REFERENTIE_WINSTMARGE =
  VPB_REFERENTIE_WINST / VPB_REFERENTIE_OPBRENGSTEN;

function isManagementfee(naam: string) {
  return naam.trim().toLowerCase().startsWith("managementfee");
}

function berekenVpbOverBelastbaarBedrag(belastbaarBedrag: number) {
  const grondslag = Math.max(0, round2(belastbaarBedrag));
  const eersteSchijf = Math.min(grondslag, VPB_DREMPEL);
  const tweedeSchijf = Math.max(0, grondslag - VPB_DREMPEL);
  return round2(
    eersteSchijf * (VPB_LAAG_PCT / 100) +
    tweedeSchijf * (VPB_HOOG_PCT / 100)
  );
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function normalizePct(v: unknown): number {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n === 0) return 0;
  return n > 1.5 ? n / 100 : n;
}

function aantalFulltimeManagers(jaar: number, maand: number) {
  if (!MANAGER_CORRECTIE_MAANDEN.includes(maand)) return 0;
  let aantal = 0;
  if (jaar >= ROBERT_FULLTIME_VAN_JAAR) aantal += 1;
  if (jaar >= EMO_FULLTIME_VAN_JAAR) aantal += 1;
  return aantal;
}

type PersoneelsUurkostenModel = {
  aantalMedewerkersMetTarief: number;
  gemiddeldeLeeftijd: number | null;
  gemiddeldeAllInUurkosten: number | null;
  werkgeverslastenPct: number;
  uitgeslotenManagers: string[];
  selectieRol: string;
  ontbrekendeTarieven: number;
};

async function getGemiddeldePersoneelsUurkosten(): Promise<PersoneelsUurkostenModel> {
  const res = await db.query(`
    WITH personeel AS (
      SELECT
        id,
        naam,
        EXTRACT(YEAR FROM age(CURRENT_DATE, geboortedatum::date))::int AS leeftijd
      FROM medewerkers
      WHERE geboortedatum IS NOT NULL
        AND lower(trim(COALESCE(rol, ''))) = 'medewerker'
        AND lower(trim(naam)) <> lower('Robert Anggono')
    )
    SELECT
      p.id,
      p.naam,
      p.leeftijd,
      l.uurloon,
      l.opslag,
      l.pensioen_opslag
    FROM personeel p
    LEFT JOIN LATERAL (
      SELECT uurloon, opslag, pensioen_opslag
      FROM loon_leeftijd
      WHERE p.leeftijd BETWEEN min_leeftijd AND max_leeftijd
        AND (geldig_van IS NULL OR CURRENT_DATE >= geldig_van)
        AND (geldig_tot IS NULL OR CURRENT_DATE <= geldig_tot)
      ORDER BY geldig_van DESC NULLS LAST, id DESC
      LIMIT 1
    ) l ON true
    ORDER BY p.id
  `);

  const kosten: number[] = [];
  const leeftijden: number[] = [];
  let ontbrekendeTarieven = 0;

  for (const r of res.rows ?? []) {
    const leeftijd = Number(r.leeftijd);
    const uurloon = Number(r.uurloon);

    if (!Number.isFinite(leeftijd)) continue;
    leeftijden.push(leeftijd);

    if (!Number.isFinite(uurloon) || uurloon <= 0) {
      ontbrekendeTarieven += 1;
      continue;
    }

    const opslag = normalizePct(r.opslag);
    const pensioen = normalizePct(r.pensioen_opslag);
    const directPerUur = uurloon * (1 + opslag + pensioen);
    const allInPerUur =
      directPerUur * (1 + WERKGEVERSLASTEN_PCT / 100);

    kosten.push(allInPerUur);
  }

  return {
    aantalMedewerkersMetTarief: kosten.length,
    gemiddeldeLeeftijd:
      leeftijden.length > 0
        ? round2(leeftijden.reduce((s, n) => s + n, 0) / leeftijden.length)
        : null,
    gemiddeldeAllInUurkosten:
      kosten.length > 0
        ? round2(kosten.reduce((s, n) => s + n, 0) / kosten.length)
        : null,
    werkgeverslastenPct: WERKGEVERSLASTEN_PCT,
    uitgeslotenManagers: ["Robert Anggono"],
    selectieRol: "medewerker",
    ontbrekendeTarieven,
  };
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

type VasteStroom = {
  id: number;
  naam: string;
  bedrag: number | null;
  btwPercentage: number;
  btwAftrekbaarPercentage: number;
  bedragIsInclusiefBtw: boolean;
};

type InkoopProfiel = {
  maand: number;
  basisKasuitstroom: number;
  basisOmzet: number;
  btwPercentage: number;
  btwAftrekbaarPercentage: number;
};

type OverigeProfiel = {
  maand: number;
  basisKasuitstroom: number;
};

type IncidentelePost = {
  datum: string;
  omschrijving: string;
  bedrag: number;
  richting: "in" | "uit";
  btwPercentage: number;
  btwAftrekbaarPercentage: number;
  bedragIsInclusiefBtw: boolean;
};

type MeerjaarMaand = {
  jaar: number;
  maand: number;
  omzet: number;
  omzetBron: "meerjaren_prognose";
  loonkosten: number | null;
  loonkostenBron:
    | "zelflerend_omzetpercentage"
    | "basisjaar_gegroeid_fallback"
    | "niet_beschikbaar";
  loonkostenPercentageGebruikt: number | null;
  loonkostenVoorManagercorrectie: number | null;
  managerAantal: number;
  managerBespaardeUren: number;
  managerCorrectie: number;
  vasteUitgaven: number | null;
  vasteStromen: VasteStroom[];
  inkoop: number | null;
  overigeUitgaven: number;
  incidenteleInkomsten: number;
  incidenteleUitgaven: number;
  incidentelePosten: IncidentelePost[];
  aflossingSchuldHoldings: number;
  dividendNaarHoldings: number;
  btwKasMutatie: number | null;
  vpbKasMutatie: number | null;
  kasmutatie: number | null;
  compleet: boolean;
  ontbrekendeConfiguratie: string[];
  beginsaldo: number | null;
  eindsaldo: number | null;
  minimumKasbuffer: number | null;
  onderMinimum: boolean | null;
};

type MeerjaarBtwKwartaal = {
  jaar: number;
  kwartaal: number;
  omzetInclBtw: number;
  btwOmzet9: number;
  voorbelasting9: number;
  voorbelasting21: number;
  modelAfdracht: number | null;
  betaaldatum: string;
  compleet: boolean;
};

type VpbPlanning = {
  tariefBronJaar: number;
  drempel: number;
  laagPct: number;
  hoogPct: number;
  methode: "fiscale_referentie_2025";
  referentieJaar: number;
  referentieOpbrengsten: number;
  referentieWinst: number;
  referentieWinstmargePct: number;
  omzetExBtw: number;
  incidenteleInkomstenExBtw: number;
  loonkosten: number;
  vasteKostenFiscaal: number;
  inkoopFiscaal: number;
  overigeKostenFiscaal: number;
  incidenteleKostenFiscaal: number;
  cashflowModelBelastbaarBedragVoorCorrecties: number;
  referentieWinstVoorManagementfees: number;
  managementfeesFiscaal: number;
  managerCorrectieWinst: number;
  belastbaarBedragVoorCorrecties: number;
  geraamdeVpb: number;
  kasEffectActief: boolean;
  betaalmaandVolgendJaar: number;
  opmerkingen: string[];
};

type MeerjaarJaar = {
  jaar: number;
  compleet: boolean;
  ontbrekendeConfiguratie: string[];
  beginsaldo: number | null;
  eindsaldo: number | null;
  laagsteSaldo: number | null;
  laagsteMaand: number | null;
  minimumKasbuffer: number | null;
  vpbPlanning: VpbPlanning | null;
  maanden: MeerjaarMaand[];
  btwKwartalen: MeerjaarBtwKwartaal[];
};

async function getEntiteitId() {
  const res = await db.query(
    `SELECT id FROM cashflow_entiteiten WHERE naam = 'IJssalon Vincenzo B.V.' LIMIT 1`
  );
  const id = Number(res.rows?.[0]?.id);
  if (!id) throw new Error("IJssalon Vincenzo B.V. ontbreekt in cashflow_entiteiten");
  return id;
}

async function getInstellingen(entiteitId: number) {
  const res = await db.query(`
    SELECT minimum_kasbuffer, prognosegroei_pct, loonkosten_groei_pct
    FROM cashflow_instellingen
    WHERE entiteit_id = $1
    LIMIT 1
  `, [entiteitId]);

  const row = res.rows?.[0] ?? {};
  return {
    minimumKasbuffer: row.minimum_kasbuffer == null ? null : Number(row.minimum_kasbuffer),
    omzetGroeiPct: row.prognosegroei_pct == null ? null : Number(row.prognosegroei_pct),
    loonkostenGroeiPct: row.loonkosten_groei_pct == null ? null : Number(row.loonkosten_groei_pct),
  };
}

async function getVasteStromen(entiteitId: number, jaar: number) {
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
      s.id,
      s.naam,
      b.id AS bedrag_id,
      b.bedrag,
      b.btw_percentage,
      b.btw_aftrekbaar_percentage,
      b.bedrag_is_inclusief_btw
    FROM maanden m
    JOIN cashflow_stromen s
      ON s.van_entiteit_id = $1
     AND s.actief = true
     AND s.gedrag = 'vast'
     AND s.frequentie = 'maandelijks'
     AND m.maand_datum >= s.startdatum
     AND (s.einddatum IS NULL OR m.maand_datum <= s.einddatum)
    LEFT JOIN LATERAL (
      SELECT b.*
      FROM cashflow_stroom_bedragen b
      WHERE b.stroom_id = s.id
        AND m.maand_datum >= b.geldig_vanaf
        AND (b.geldig_tot IS NULL OR m.maand_datum <= b.geldig_tot)
      ORDER BY b.geldig_vanaf DESC
      LIMIT 1
    ) b ON true
    ORDER BY maand, s.naam
  `, [entiteitId, jaar]);

  const map = new Map<number, VasteStroom[]>();
  for (let maand = 1; maand <= 12; maand++) map.set(maand, []);

  for (const r of res.rows ?? []) {
    const btwPercentage = Number(r.btw_percentage) || 0;
    const inclusief = r.bedrag_is_inclusief_btw !== false;
    const bedrag = r.bedrag_id == null || r.bedrag == null
      ? null
      : naarKasBedrag(Number(r.bedrag), btwPercentage, inclusief);

    map.get(Number(r.maand))!.push({
      id: Number(r.id),
      naam: String(r.naam),
      bedrag,
      btwPercentage,
      btwAftrekbaarPercentage: Number(r.btw_aftrekbaar_percentage) || 0,
      bedragIsInclusiefBtw: inclusief,
    });
  }

  return map;
}

async function getInkoopProfielen(entiteitId: number): Promise<Map<number, InkoopProfiel>> {
  const res = await db.query(`
    SELECT
      p.maand,
      p.basis_kasuitstroom,
      p.btw_percentage,
      p.btw_aftrekbaar_percentage,
      COALESCE(SUM(o.aantal * o.eenheidsprijs), 0) AS basis_omzet
    FROM cashflow_inkoopprofiel p
    LEFT JOIN rapportage.omzet o
      ON EXTRACT(YEAR FROM o.datum)::int = p.basisjaar
     AND EXTRACT(MONTH FROM o.datum)::int = p.maand
    WHERE p.entiteit_id = $1
      AND p.actief = true
    GROUP BY p.id, p.maand, p.basis_kasuitstroom,
             p.btw_percentage, p.btw_aftrekbaar_percentage
    ORDER BY p.maand
  `, [entiteitId]);

  const map = new Map<number, InkoopProfiel>();
  for (const r of res.rows ?? []) {
    map.set(Number(r.maand), {
      maand: Number(r.maand),
      basisKasuitstroom: Number(r.basis_kasuitstroom) || 0,
      basisOmzet: Number(r.basis_omzet) || 0,
      btwPercentage: Number(r.btw_percentage) || 0,
      btwAftrekbaarPercentage: Number(r.btw_aftrekbaar_percentage) || 0,
    });
  }
  return map;
}

async function getOverigeProfielen(entiteitId: number): Promise<Map<number, OverigeProfiel>> {
  const res = await db.query(`
    SELECT maand, basis_kasuitstroom
    FROM cashflow_overige_profiel
    WHERE entiteit_id = $1
      AND actief = true
    ORDER BY maand
  `, [entiteitId]);

  const map = new Map<number, OverigeProfiel>();
  for (const r of res.rows ?? []) {
    map.set(Number(r.maand), {
      maand: Number(r.maand),
      basisKasuitstroom: Number(r.basis_kasuitstroom) || 0,
    });
  }
  return map;
}

async function getIncidentelePosten(entiteitId: number, jaar: number) {
  const res = await db.query(`
    SELECT datum::text AS datum, omschrijving, bedrag, richting,
           btw_percentage, btw_aftrekbaar_percentage, bedrag_is_inclusief_btw
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
      richting: r.richting === "in" ? "in" : "uit",
      btwPercentage: Number(r.btw_percentage) || 0,
      btwAftrekbaarPercentage: Number(r.btw_aftrekbaar_percentage) || 0,
      bedragIsInclusiefBtw: r.bedrag_is_inclusief_btw !== false,
    });
  }
  return map;
}

function btwBetaaldatum(jaar: number, kwartaal: number) {
  if (kwartaal === 1) return `${jaar}-04-30`;
  if (kwartaal === 2) return `${jaar}-07-31`;
  if (kwartaal === 3) return `${jaar}-10-31`;
  return `${jaar + 1}-01-31`;
}

export async function berekenVincenzoMeerjaren(totJaar: number) {
  const huidigJaar = new Date().getFullYear();
  if (!Number.isInteger(totJaar) || totJaar < huidigJaar || totJaar > huidigJaar + 10) {
    throw new Error(`totJaar moet tussen ${huidigJaar} en ${huidigJaar + 10} liggen`);
  }

  const basis = await berekenVincenzoBasis(huidigJaar);
  const entiteitId = await getEntiteitId();
  const instellingen = await getInstellingen(entiteitId);

  // 4N-B: maak expliciet zichtbaar welke maanden inmiddels echte cijfers
  // gebruiken en welke maanden nog prognose zijn. De meerjarenmotor bouwt
  // daarna rechtstreeks op deze maandregels voort. Daardoor vervangt iedere
  // afgesloten maand automatisch de oude prognosebasis door werkelijkheid.
  const herijkingMaanden = basis.maanden.map((m) => ({
    maand: m.maand,
    omzet: m.omzet,
    omzetBron: m.omzetBron,
    loonkosten: m.loonkosten,
    loonkostenBron: m.loonkostenBron,
    seizoen: SEIZOEN_MAANDEN.includes(m.maand),
    gebruiktAlsMeerjarenbasis: true,
  }));

  const basisHerijking = {
    peildatum: basis.prognoseGrens.peildatum,
    afgeslotenTotMaand: basis.prognoseGrens.afgeslotenTotMaand,
    eerstePrognoseMaand: basis.prognoseGrens.eerstePrognoseMaand,
    omzetWerkelijkMaanden: herijkingMaanden
      .filter((m) => m.seizoen && m.omzetBron === "werkelijk")
      .map((m) => m.maand),
    omzetPrognoseMaanden: herijkingMaanden
      .filter((m) => m.seizoen && m.omzetBron === "prognose")
      .map((m) => m.maand),
    loonkostenWerkelijkMaanden: herijkingMaanden
      .filter((m) => m.seizoen && m.loonkostenBron === "werkelijk")
      .map((m) => m.maand),
    loonkostenPrognoseMaanden: herijkingMaanden
      .filter((m) => m.seizoen && m.loonkostenBron !== "werkelijk")
      .map((m) => m.maand),
    omzetWerkelijkTotaal: round2(
      herijkingMaanden
        .filter((m) => m.seizoen && m.omzetBron === "werkelijk")
        .reduce((som, m) => som + Number(m.omzet ?? 0), 0)
    ),
    omzetPrognoseTotaal: round2(
      herijkingMaanden
        .filter((m) => m.seizoen && m.omzetBron === "prognose")
        .reduce((som, m) => som + Number(m.omzet ?? 0), 0)
    ),
    loonkostenWerkelijkTotaal: round2(
      herijkingMaanden
        .filter(
          (m) =>
            m.seizoen &&
            m.loonkostenBron === "werkelijk" &&
            m.loonkosten != null
        )
        .reduce((som, m) => som + Number(m.loonkosten ?? 0), 0)
    ),
    loonkostenPrognoseTotaal: round2(
      herijkingMaanden
        .filter(
          (m) =>
            m.seizoen &&
            m.loonkostenBron !== "werkelijk" &&
            m.loonkosten != null
        )
        .reduce((som, m) => som + Number(m.loonkosten ?? 0), 0)
    ),
    toekomstigeJarenGebruikenHerijkteBasis: true,
    maanden: herijkingMaanden,
  };

  const leerMaanden = herijkingMaanden.filter(
    (m) =>
      m.seizoen &&
      m.omzetBron === "werkelijk" &&
      m.loonkostenBron === "werkelijk" &&
      Number(m.omzet ?? 0) > 0 &&
      m.loonkosten != null
  );

  const leerOmzetTotaal = round2(
    leerMaanden.reduce((som, m) => som + Number(m.omzet ?? 0), 0)
  );
  const leerLoonkostenTotaal = round2(
    leerMaanden.reduce((som, m) => som + Number(m.loonkosten ?? 0), 0)
  );
  const geleerdLoonkostenPct =
    leerOmzetTotaal > 0
      ? round2((leerLoonkostenTotaal / leerOmzetTotaal) * 100)
      : null;

  const loonkostenLeerModel = {
    methode: "gewogen_werkelijke_loonkosten_door_werkelijke_omzet",
    alleenAfgeslotenWerkelijkeMaanden: true,
    maanden: leerMaanden.map((m) => ({
      maand: m.maand,
      omzet: round2(Number(m.omzet ?? 0)),
      loonkosten: round2(Number(m.loonkosten ?? 0)),
      percentage:
        Number(m.omzet ?? 0) > 0
          ? round2((Number(m.loonkosten ?? 0) / Number(m.omzet ?? 0)) * 100)
          : null,
    })),
    omzetTotaal: leerOmzetTotaal,
    loonkostenTotaal: leerLoonkostenTotaal,
    gewogenPercentage: geleerdLoonkostenPct,
  };

  const personeelsUurkosten = await getGemiddeldePersoneelsUurkosten();

  const waarschuwingen: string[] = [...basis.waarschuwingen];
  if (instellingen.omzetGroeiPct == null) {
    waarschuwingen.push("Omzetgroei ontbreekt in Cashflowbeheer; meerjarenomzet kan niet volledig worden berekend.");
  }
  if (instellingen.loonkostenGroeiPct == null) {
    waarschuwingen.push("Loonkostengroei ontbreekt in Cashflowbeheer; toekomstige loonkosten kunnen niet volledig worden berekend.");
  }
  if (geleerdLoonkostenPct == null) {
    waarschuwingen.push(
      "Zelflerend loonkostenpercentage kon niet worden bepaald; meerjarenprognose valt waar mogelijk terug op de oude basisjaar-methode."
    );
  }
  if (personeelsUurkosten.gemiddeldeAllInUurkosten == null) {
    waarschuwingen.push(
      "Gemiddelde all-in personeelsuurkost kon niet worden bepaald; managercorrectie kan niet worden toegepast."
    );
  }
  if (personeelsUurkosten.ontbrekendeTarieven > 0) {
    waarschuwingen.push(
      `Voor ${personeelsUurkosten.ontbrekendeTarieven} medewerker(s) met geboortedatum ontbreekt een geldig leeftijdstarief; zij tellen niet mee in het gemiddelde uurbedrag.`
    );
  }
  waarschuwingen.push(
    "Overige reguliere uitgaven worden in fase 4F nominaal gelijk gehouden aan het historische maandprofiel; hiervoor wordt nog geen afzonderlijke jaarlijkse kostenindex toegepast."
  );

  if (!basis.cashPositie.beschikbaar || basis.cashPositie.eindsaldo == null) {
    return {
      vanafJaar: huidigJaar,
      totJaar,
      beschikbaar: false,
      reden: basis.cashPositie.reden ?? "Kaspositie basisjaar is niet beschikbaar",
      instellingen: {
        ...instellingen,
        vpb: {
          tariefBronJaar: VPB_TARIEF_BRONJAAR,
          drempel: VPB_DREMPEL,
          laagPct: VPB_LAAG_PCT,
          hoogPct: VPB_HOOG_PCT,
          betaalmaandVolgendJaar: VPB_BETAALMAAND_VOLGEND_JAAR,
          kasEffectActief: true,
        },
      },
      waarschuwingen: [...new Set(waarschuwingen)],
      loonkostenModel: {
        leerbasis: loonkostenLeerModel,
        personeelsUurkosten,
        managerAannames: {
          dagenPerWeek: MANAGER_DAGEN_PER_WEEK,
          urenPerDag: MANAGER_UREN_PER_DAG,
          productiefPct: MANAGER_PRODUCTIEF_PCT,
          vervangingPct: MANAGER_VERVANGING_PCT,
          bespaardeUrenPerManagerPerMaand: round2(
            BESPAARDE_UREN_PER_MANAGER_PER_MAAND
          ),
          robertFulltimeVanJaar: ROBERT_FULLTIME_VAN_JAAR,
          emoFulltimeVanJaar: EMO_FULLTIME_VAN_JAAR,
          maanden: MANAGER_CORRECTIE_MAANDEN,
        },
      },
      basisjaar: {
        jaar: huidigJaar,
        peildatum: basis.cashPositie.peildatum,
        prognoseGrens: basis.prognoseGrens,
        herijking: basisHerijking,
        startsaldo: basis.cashPositie.startsaldoTotaal,
        eindsaldo: basis.cashPositie.eindsaldo,
        maanden: basis.maanden,
        btwKwartalen: basis.btwKwartalen,
      },
      jaren: [] as MeerjaarJaar[],
    };
  }

  const [inkoopProfielen, overigeProfielen, vincenzoHoldingUitkeringen] = await Promise.all([
    getInkoopProfielen(entiteitId),
    getOverigeProfielen(entiteitId),
    berekenVincenzoNaarHoldingUitkeringen(totJaar),
  ]);

  const basisMaanden = new Map<number, (typeof basis.maanden)[number]>();
  for (const m of basis.maanden) basisMaanden.set(m.maand, m);

  // 4O-B: ook voor het basisjaar ramen we VPB, zodat de eerste toekomstige
  // betaling (augustus van het volgende jaar) niet ontbreekt.
  const basisVpbInput = {
    omzetExBtw: 0,
    incidenteleInkomstenExBtw: 0,
    loonkosten: 0,
    vasteKostenFiscaal: 0,
    inkoopFiscaal: 0,
    overigeKostenFiscaal: 0,
    incidenteleKostenFiscaal: 0,
    managementfeesFiscaal: 0,
    heeftOnvolledigeMaand: false,
    heeftIncidentelePosten: false,
  };

  const basisVpbStartMaand =
    huidigJaar === VPB_EERSTE_BV_JAAR ? VPB_EERSTE_BV_MAAND : 1;

  for (const m of basis.maanden.filter((x) => x.maand >= basisVpbStartMaand)) {
    if (m.loonkosten == null || m.inkoop == null) {
      basisVpbInput.heeftOnvolledigeMaand = true;
      continue;
    }

    const omzetBtw = round2(Number(m.omzet || 0) * 9 / 109);
    basisVpbInput.omzetExBtw += round2(Number(m.omzet || 0) - omzetBtw);
    basisVpbInput.loonkosten += Number(m.loonkosten || 0);

    for (const s of m.vasteStromen ?? []) {
      const aftrekbareBtw = btwUitBedrag(
        Number(s.bedrag || 0),
        Number(s.btwPercentage || 0),
        Number(s.btwAftrekbaarPercentage || 0),
        true
      );
      const fiscaalBedrag = round2(Number(s.bedrag || 0) - aftrekbareBtw);
      basisVpbInput.vasteKostenFiscaal += fiscaalBedrag;
      if (isManagementfee(s.naam)) {
        basisVpbInput.managementfeesFiscaal += fiscaalBedrag;
      }
    }

    const inkoopProfiel = inkoopProfielen.get(m.maand);
    if (inkoopProfiel) {
      const aftrekbareBtwInkoop = btwUitBedrag(
        Number(m.inkoop || 0),
        inkoopProfiel.btwPercentage,
        inkoopProfiel.btwAftrekbaarPercentage,
        true
      );
      basisVpbInput.inkoopFiscaal += round2(
        Number(m.inkoop || 0) - aftrekbareBtwInkoop
      );
    } else {
      basisVpbInput.inkoopFiscaal += Number(m.inkoop || 0);
    }

    basisVpbInput.overigeKostenFiscaal += Number(m.overigeUitgaven || 0);

    if ((m.incidentelePosten ?? []).length > 0) {
      basisVpbInput.heeftIncidentelePosten = true;
    }

    for (const p of m.incidentelePosten ?? []) {
      if (p.richting === "in") {
        const outputBtw = btwUitBedrag(
          p.bedrag,
          p.btwPercentage,
          100,
          p.bedragIsInclusiefBtw
        );
        basisVpbInput.incidenteleInkomstenExBtw += round2(
          p.bedrag - outputBtw
        );
      } else {
        const aftrekbareBtw = btwUitBedrag(
          p.bedrag,
          p.btwPercentage,
          p.btwAftrekbaarPercentage,
          p.bedragIsInclusiefBtw
        );
        basisVpbInput.incidenteleKostenFiscaal += round2(
          p.bedrag - aftrekbareBtw
        );
      }
    }
  }

  const basisCashflowModelBelastbaarBedragVoorCorrecties = round2(
    basisVpbInput.omzetExBtw
    + basisVpbInput.incidenteleInkomstenExBtw
    - basisVpbInput.loonkosten
    - basisVpbInput.vasteKostenFiscaal
    - basisVpbInput.inkoopFiscaal
    - basisVpbInput.overigeKostenFiscaal
    - basisVpbInput.incidenteleKostenFiscaal
  );
  const basisReferentieWinstVoorManagementfees = round2(
    basisVpbInput.omzetExBtw * VPB_REFERENTIE_WINSTMARGE
  );
  const basisManagerCorrectieWinst = 0;
  const basisBelastbaarBedragVoorCorrecties = round2(
    basisReferentieWinstVoorManagementfees
    + basisManagerCorrectieWinst
    - basisVpbInput.managementfeesFiscaal
  );

  const basisVpbPlanning: VpbPlanning | null =
    basisVpbInput.heeftOnvolledigeMaand
      ? null
      : {
          tariefBronJaar: VPB_TARIEF_BRONJAAR,
          drempel: VPB_DREMPEL,
          laagPct: VPB_LAAG_PCT,
          hoogPct: VPB_HOOG_PCT,
          methode: "fiscale_referentie_2025",
          referentieJaar: VPB_REFERENTIE_JAAR,
          referentieOpbrengsten: VPB_REFERENTIE_OPBRENGSTEN,
          referentieWinst: VPB_REFERENTIE_WINST,
          referentieWinstmargePct: round2(VPB_REFERENTIE_WINSTMARGE * 100),
          omzetExBtw: round2(basisVpbInput.omzetExBtw),
          incidenteleInkomstenExBtw: round2(
            basisVpbInput.incidenteleInkomstenExBtw
          ),
          loonkosten: round2(basisVpbInput.loonkosten),
          vasteKostenFiscaal: round2(basisVpbInput.vasteKostenFiscaal),
          inkoopFiscaal: round2(basisVpbInput.inkoopFiscaal),
          overigeKostenFiscaal: round2(basisVpbInput.overigeKostenFiscaal),
          incidenteleKostenFiscaal: round2(
            basisVpbInput.incidenteleKostenFiscaal
          ),
          cashflowModelBelastbaarBedragVoorCorrecties:
            basisCashflowModelBelastbaarBedragVoorCorrecties,
          referentieWinstVoorManagementfees:
            basisReferentieWinstVoorManagementfees,
          managementfeesFiscaal: round2(basisVpbInput.managementfeesFiscaal),
          managerCorrectieWinst: basisManagerCorrectieWinst,
          belastbaarBedragVoorCorrecties: basisBelastbaarBedragVoorCorrecties,
          geraamdeVpb: berekenVpbOverBelastbaarBedrag(
            basisBelastbaarBedragVoorCorrecties
          ),
          kasEffectActief: true,
          betaalmaandVolgendJaar: VPB_BETAALMAAND_VOLGEND_JAAR,
          opmerkingen: [
            `Voor ${huidigJaar} rekent de prognose vanaf maand ${basisVpbStartMaand}.`,
            `VPB-hoofdschatting gebruikt de fiscale winstmarge ${round2(VPB_REFERENTIE_WINSTMARGE * 100)}% uit jaarrekening ${VPB_REFERENTIE_JAAR}, daarna verminderd met managementfees.`,
            "De oude cashflow-afgeleide winst blijft zichtbaar als controleveld, maar stuurt de VPB-kasbetaling niet meer.",
            "Afschrijvingen, KIA, verliesverrekening en overige fiscale correcties zijn nog niet afzonderlijk gemodelleerd.",
            ...(basisVpbInput.heeftIncidentelePosten
              ? ["Incidentele posten worden als opbrengst/kosten behandeld; investeringen kunnen fiscaal anders verwerkt moeten worden."]
              : []),
          ],
        };

  let doorlopendSaldo: number | null = basis.cashPositie.eindsaldo;
  const basisQ4Afdracht: number | null = basis.btwKwartalen.find((q) => q.kwartaal === 4)?.gebruikteAfdracht ?? null;
  let vorigeQ4Afdracht: number | null = basisQ4Afdracht;
  let vorigeVpbPlanning: VpbPlanning | null = basisVpbPlanning;
  const jaren: MeerjaarJaar[] = [];

  for (let jaar = huidigJaar + 1; jaar <= totJaar; jaar++) {
    const [vastePerMaand, incidenteelPerMaand] = await Promise.all([
      getVasteStromen(entiteitId, jaar),
      getIncidentelePosten(entiteitId, jaar),
    ]);

    const omzetFactor = instellingen.omzetGroeiPct == null
      ? null
      : Math.pow(1 + instellingen.omzetGroeiPct / 100, jaar - huidigJaar);
    const loonFactor = instellingen.loonkostenGroeiPct == null
      ? null
      : Math.pow(1 + instellingen.loonkostenGroeiPct / 100, jaar - huidigJaar);

    // De omzetprognose groeit al met omzetGroeiPct. Door het geleerde
    // loonkostenpercentage met loonFactor/omzetFactor te corrigeren, blijft
    // ook de bestaande aparte loonstijgingsaanname intact.
    const loonkostenPctJaar =
      geleerdLoonkostenPct == null ||
      loonFactor == null ||
      omzetFactor == null ||
      omzetFactor <= 0
        ? null
        : (geleerdLoonkostenPct / 100) * (loonFactor / omzetFactor);

    const maanden: MeerjaarMaand[] = [];
    const vpbInput = {
      omzetExBtw: 0,
      incidenteleInkomstenExBtw: 0,
      loonkosten: 0,
      vasteKostenFiscaal: 0,
      inkoopFiscaal: 0,
      overigeKostenFiscaal: 0,
      incidenteleKostenFiscaal: 0,
      managementfeesFiscaal: 0,
      heeftOnvolledigeMaand: false,
      heeftIncidentelePosten: false,
    };

    const kwartaalInput: Array<{
      maand: number;
      compleet: boolean;
      omzet: number;
      btwOmzet: number;
      voorbelasting9: number;
      voorbelasting21: number;
    }> = [];

    for (let maand = 1; maand <= 12; maand++) {
      const ontbrekend: string[] = [];
      const basisMaand = basisMaanden.get(maand);

      let omzet = 0;
      if (SEIZOEN_MAANDEN.includes(maand)) {
        if (omzetFactor == null || !basisMaand) {
          ontbrekend.push("omzetgroei/basisomzet");
        } else {
          omzet = round2(Number(basisMaand.omzet || 0) * omzetFactor);
        }
      }

      let loonkosten: number | null = 0;
      let loonkostenBron: MeerjaarMaand["loonkostenBron"] =
        "zelflerend_omzetpercentage";
      let loonkostenPercentageGebruikt: number | null = null;
      let loonkostenVoorManagercorrectie: number | null = 0;
      const managerAantal = aantalFulltimeManagers(jaar, maand);
      const managerBespaardeUren = round2(
        managerAantal * BESPAARDE_UREN_PER_MANAGER_PER_MAAND
      );
      let managerCorrectie = 0;

      if (SEIZOEN_MAANDEN.includes(maand)) {
        if (
          loonkostenPctJaar != null &&
          personeelsUurkosten.gemiddeldeAllInUurkosten != null &&
          loonFactor != null
        ) {
          loonkostenPercentageGebruikt = round2(loonkostenPctJaar * 100);
          loonkostenVoorManagercorrectie = round2(omzet * loonkostenPctJaar);

          const uurkostenInJaar = round2(
            personeelsUurkosten.gemiddeldeAllInUurkosten * loonFactor
          );
          managerCorrectie = round2(
            managerBespaardeUren * uurkostenInJaar
          );

          loonkosten = round2(
            Math.max(
              0,
              Number(loonkostenVoorManagercorrectie) - managerCorrectie
            )
          );
        } else if (loonFactor != null && basisMaand?.loonkosten != null) {
          // Veilige fallback: de oude, reeds bewezen methode blijft beschikbaar
          // als de leerbasis of personeelsuurkost onverwacht ontbreekt.
          loonkosten = round2(Number(basisMaand.loonkosten) * loonFactor);
          loonkostenVoorManagercorrectie = loonkosten;
          loonkostenBron = "basisjaar_gegroeid_fallback";
          managerCorrectie = 0;
        } else {
          loonkosten = null;
          loonkostenVoorManagercorrectie = null;
          loonkostenBron = "niet_beschikbaar";
          managerCorrectie = 0;
          ontbrekend.push("zelflerende loonkosten/basisgegevens");
        }
      } else {
        managerCorrectie = 0;
      }

      const vasteStromen = vastePerMaand.get(maand) ?? [];
      const ontbrekendeTarieven = vasteStromen.filter((s) => s.bedrag == null);
      for (const s of ontbrekendeTarieven) ontbrekend.push(`tarief: ${s.naam}`);
      const vasteUitgaven = ontbrekendeTarieven.length
        ? null
        : round2(vasteStromen.reduce((som, s) => som + Number(s.bedrag ?? 0), 0));

      const inkoopProfiel = inkoopProfielen.get(maand);
      let inkoop: number | null = 0;
      if (inkoopProfiel) {
        if (inkoopProfiel.basisOmzet <= 0) {
          inkoop = null;
          ontbrekend.push("inkoop-basisomzet");
        } else {
          inkoop = round2(inkoopProfiel.basisKasuitstroom * (omzet / inkoopProfiel.basisOmzet));
        }
      }

      const overigeUitgaven = round2(overigeProfielen.get(maand)?.basisKasuitstroom ?? 0);
      const incidentelePosten = incidenteelPerMaand.get(maand) ?? [];
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

      let voorbelasting9 = 0;
      let voorbelasting21 = 0;
      if (inkoop !== null && inkoopProfiel) {
        const aftrek = btwUitBedrag(
          inkoop,
          inkoopProfiel.btwPercentage,
          inkoopProfiel.btwAftrekbaarPercentage,
          true
        );
        if (Math.abs(inkoopProfiel.btwPercentage - 9) < 0.001) voorbelasting9 += aftrek;
        else if (Math.abs(inkoopProfiel.btwPercentage - 21) < 0.001) voorbelasting21 += aftrek;
      }

      for (const s of vasteStromen) {
        if (s.bedrag == null) continue;
        const aftrek = btwUitBedrag(
          s.bedrag,
          s.btwPercentage,
          s.btwAftrekbaarPercentage,
          true
        );
        if (Math.abs(s.btwPercentage - 9) < 0.001) voorbelasting9 += aftrek;
        else if (Math.abs(s.btwPercentage - 21) < 0.001) voorbelasting21 += aftrek;
      }

      for (const p of incidentelePosten.filter((x) => x.richting === "uit")) {
        const aftrek = btwUitBedrag(
          p.bedrag,
          p.btwPercentage,
          p.btwAftrekbaarPercentage,
          p.bedragIsInclusiefBtw
        );
        if (Math.abs(p.btwPercentage - 9) < 0.001) voorbelasting9 += aftrek;
        else if (Math.abs(p.btwPercentage - 21) < 0.001) voorbelasting21 += aftrek;
      }

      const compleet = ontbrekend.length === 0 && loonkosten !== null && vasteUitgaven !== null && inkoop !== null;

      // VPB-planningsbasis (4O-A)
      // Omzet en incidentele inkomsten worden exclusief af te dragen BTW genomen.
      // Kosten worden verminderd met de BTW die in ditzelfde model aftrekbaar is.
      if (!compleet || loonkosten == null || vasteUitgaven == null || inkoop == null) {
        vpbInput.heeftOnvolledigeMaand = true;
      } else {
        const omzetBtw = round2(omzet * 9 / 109);
        vpbInput.omzetExBtw += round2(omzet - omzetBtw);
        vpbInput.loonkosten += Number(loonkosten);

        for (const s of vasteStromen) {
          if (s.bedrag == null) continue;
          const aftrekbareBtw = btwUitBedrag(
            s.bedrag,
            s.btwPercentage,
            s.btwAftrekbaarPercentage,
            true
          );
          const fiscaalBedrag = round2(s.bedrag - aftrekbareBtw);
          vpbInput.vasteKostenFiscaal += fiscaalBedrag;
          if (isManagementfee(s.naam)) {
            vpbInput.managementfeesFiscaal += fiscaalBedrag;
          }
        }

        if (inkoopProfiel) {
          const aftrekbareBtwInkoop = btwUitBedrag(
            inkoop,
            inkoopProfiel.btwPercentage,
            inkoopProfiel.btwAftrekbaarPercentage,
            true
          );
          vpbInput.inkoopFiscaal += round2(inkoop - aftrekbareBtwInkoop);
        } else {
          vpbInput.inkoopFiscaal += Number(inkoop);
        }

        // Voor "overige reguliere uitgaven" kennen we bewust geen betrouwbare
        // BTW-splitsing. Daarom nemen we voor de VPB-planning het volledige
        // kasbedrag als kostenpost. Dit is transparant/conservatief en voorkomt
        // dat we fictieve voorbelasting construeren.
        vpbInput.overigeKostenFiscaal += overigeUitgaven;

        if (incidentelePosten.length > 0) {
          vpbInput.heeftIncidentelePosten = true;
        }

        for (const p of incidentelePosten) {
          if (p.richting === "in") {
            const outputBtw = btwUitBedrag(
              p.bedrag,
              p.btwPercentage,
              100,
              p.bedragIsInclusiefBtw
            );
            vpbInput.incidenteleInkomstenExBtw += round2(p.bedrag - outputBtw);
          } else {
            const aftrekbareBtw = btwUitBedrag(
              p.bedrag,
              p.btwPercentage,
              p.btwAftrekbaarPercentage,
              p.bedragIsInclusiefBtw
            );
            vpbInput.incidenteleKostenFiscaal += round2(p.bedrag - aftrekbareBtw);
          }
        }
      }

      kwartaalInput.push({
        maand,
        compleet,
        omzet,
        btwOmzet: round2(
          omzet * 9 / 109 +
          incidentelePosten
            .filter((p) => p.richting === "in")
            .reduce(
              (som, p) =>
                som +
                btwUitBedrag(
                  p.bedrag,
                  p.btwPercentage,
                  100,
                  p.bedragIsInclusiefBtw
                ),
              0
            )
        ),
        voorbelasting9: round2(voorbelasting9),
        voorbelasting21: round2(voorbelasting21),
      });

      maanden.push({
        jaar,
        maand,
        omzet,
        omzetBron: "meerjaren_prognose",
        loonkosten,
        loonkostenBron,
        loonkostenPercentageGebruikt,
        loonkostenVoorManagercorrectie,
        managerAantal,
        managerBespaardeUren,
        managerCorrectie,
        vasteUitgaven,
        vasteStromen,
        inkoop,
        overigeUitgaven,
        incidenteleInkomsten,
        incidenteleUitgaven,
        incidentelePosten,
        aflossingSchuldHoldings,
        dividendNaarHoldings,
        btwKasMutatie: 0,
        vpbKasMutatie: 0,
        kasmutatie: null,
        compleet,
        ontbrekendeConfiguratie: [...new Set(ontbrekend)],
        beginsaldo: null,
        eindsaldo: null,
        minimumKasbuffer: instellingen.minimumKasbuffer,
        onderMinimum: null,
      });
    }

    const btwKwartalen: MeerjaarBtwKwartaal[] = [];
    for (let kwartaal = 1; kwartaal <= 4; kwartaal++) {
      const eerste = (kwartaal - 1) * 3 + 1;
      const regels = kwartaalInput.filter((r) => r.maand >= eerste && r.maand <= eerste + 2);
      const compleet = regels.length === 3 && regels.every((r) => r.compleet);
      const omzetInclBtw = round2(regels.reduce((s, r) => s + r.omzet, 0));
      const btwOmzet9 = round2(regels.reduce((s, r) => s + r.btwOmzet, 0));
      const voorbelasting9 = round2(regels.reduce((s, r) => s + r.voorbelasting9, 0));
      const voorbelasting21 = round2(regels.reduce((s, r) => s + r.voorbelasting21, 0));
      const modelAfdracht = compleet
        ? round2(btwOmzet9 - voorbelasting9 - voorbelasting21)
        : null;

      btwKwartalen.push({
        jaar,
        kwartaal,
        omzetInclBtw,
        btwOmzet9,
        voorbelasting9,
        voorbelasting21,
        modelAfdracht,
        betaaldatum: btwBetaaldatum(jaar, kwartaal),
        compleet,
      });
    }

    // Q4 van het vorige jaar komt in januari van dit jaar op de bank.
    const januari = maanden[0];
    if (vorigeQ4Afdracht == null) {
      januari.btwKasMutatie = null;
      januari.compleet = false;
      januari.ontbrekendeConfiguratie.push(`BTW Q4 ${jaar - 1}`);
    } else {
      januari.btwKasMutatie = round2(-vorigeQ4Afdracht);
    }

    // Q1, Q2 en Q3 worden in april, juli en oktober van hetzelfde jaar betaald.
    for (const q of btwKwartalen.filter((x) => x.kwartaal <= 3)) {
      const betaalMaand = q.kwartaal === 1 ? 4 : q.kwartaal === 2 ? 7 : 10;
      const m = maanden[betaalMaand - 1];
      if (q.modelAfdracht == null) {
        m.btwKasMutatie = null;
        m.compleet = false;
        m.ontbrekendeConfiguratie.push(`BTW Q${q.kwartaal} ${jaar}`);
      } else {
        m.btwKasMutatie = round2(-q.modelAfdracht);
      }
    }

    // VPB: planningsmatig betalen we de geraamde VPB over het vorige jaar
    // in augustus. Dit sluit aan bij aangifte in het volgende voorjaar en een
    // aanslag/betaaltermijn daarna. Werkelijke aanslagen kunnen later als
    // actualiteit de prognose vervangen.
    const vpbBetaalMaand = maanden[VPB_BETAALMAAND_VOLGEND_JAAR - 1];
    if (vorigeVpbPlanning == null) {
      vpbBetaalMaand.vpbKasMutatie = null;
      vpbBetaalMaand.compleet = false;
      vpbBetaalMaand.ontbrekendeConfiguratie.push(`VPB ${jaar - 1}`);
    } else {
      vpbBetaalMaand.vpbKasMutatie = round2(-vorigeVpbPlanning.geraamdeVpb);
    }

    // Alle overige maanden hebben geen kwartaal-BTW-kasmutatie.
    for (const m of maanden) {
      if (m.btwKasMutatie === null || m.vpbKasMutatie === null) {
        m.kasmutatie = null;
        continue;
      }
      if (!m.compleet || m.loonkosten == null || m.vasteUitgaven == null || m.inkoop == null) {
        m.kasmutatie = null;
        continue;
      }
      m.kasmutatie = round2(
        m.omzet
        - m.loonkosten
        - m.vasteUitgaven
        - m.inkoop
        - m.overigeUitgaven
        - m.incidenteleUitgaven
        - m.aflossingSchuldHoldings
        - m.dividendNaarHoldings
        + m.incidenteleInkomsten
        + m.btwKasMutatie
        + m.vpbKasMutatie
      );
    }

    const cashflowModelBelastbaarBedragVoorCorrecties = round2(
      vpbInput.omzetExBtw
      + vpbInput.incidenteleInkomstenExBtw
      - vpbInput.loonkosten
      - vpbInput.vasteKostenFiscaal
      - vpbInput.inkoopFiscaal
      - vpbInput.overigeKostenFiscaal
      - vpbInput.incidenteleKostenFiscaal
    );
    const referentieWinstVoorManagementfees = round2(
      vpbInput.omzetExBtw * VPB_REFERENTIE_WINSTMARGE
    );
    const managerCorrectieWinst = round2(
      maanden.reduce((som, m) => som + Number(m.managerCorrectie || 0), 0)
    );
    const belastbaarBedragVoorCorrecties = round2(
      referentieWinstVoorManagementfees
      + managerCorrectieWinst
      - vpbInput.managementfeesFiscaal
    );

    const vpbPlanning: VpbPlanning | null = vpbInput.heeftOnvolledigeMaand
      ? null
      : {
          tariefBronJaar: VPB_TARIEF_BRONJAAR,
          drempel: VPB_DREMPEL,
          laagPct: VPB_LAAG_PCT,
          hoogPct: VPB_HOOG_PCT,
          methode: "fiscale_referentie_2025",
          referentieJaar: VPB_REFERENTIE_JAAR,
          referentieOpbrengsten: VPB_REFERENTIE_OPBRENGSTEN,
          referentieWinst: VPB_REFERENTIE_WINST,
          referentieWinstmargePct: round2(VPB_REFERENTIE_WINSTMARGE * 100),
          omzetExBtw: round2(vpbInput.omzetExBtw),
          incidenteleInkomstenExBtw: round2(vpbInput.incidenteleInkomstenExBtw),
          loonkosten: round2(vpbInput.loonkosten),
          vasteKostenFiscaal: round2(vpbInput.vasteKostenFiscaal),
          inkoopFiscaal: round2(vpbInput.inkoopFiscaal),
          overigeKostenFiscaal: round2(vpbInput.overigeKostenFiscaal),
          incidenteleKostenFiscaal: round2(vpbInput.incidenteleKostenFiscaal),
          cashflowModelBelastbaarBedragVoorCorrecties,
          referentieWinstVoorManagementfees,
          managementfeesFiscaal: round2(vpbInput.managementfeesFiscaal),
          managerCorrectieWinst,
          belastbaarBedragVoorCorrecties,
          geraamdeVpb: berekenVpbOverBelastbaarBedrag(
            belastbaarBedragVoorCorrecties
          ),
          kasEffectActief: true,
          betaalmaandVolgendJaar: VPB_BETAALMAAND_VOLGEND_JAAR,
          opmerkingen: [
            `VPB-hoofdschatting gebruikt de fiscale winstmarge ${round2(VPB_REFERENTIE_WINSTMARGE * 100)}% uit jaarrekening ${VPB_REFERENTIE_JAAR}, gecorrigeerd voor managementfees en managerbesparing.`,
            "De oude cashflow-afgeleide winst blijft zichtbaar als controleveld, maar stuurt de VPB-kasbetaling niet meer.",
            "Afschrijvingen, KIA, verliesverrekening en overige fiscale correcties zijn nog niet afzonderlijk gemodelleerd.",
            ...(vpbInput.heeftIncidentelePosten
              ? ["Incidentele posten worden als opbrengst/kosten behandeld; investeringen kunnen fiscaal anders verwerkt moeten worden."]
              : []),
          ],
        };

    const jaarBeginsaldo = doorlopendSaldo;
    let laagsteSaldo: number | null = null;
    let laagsteMaand: number | null = null;

    for (const m of maanden) {
      if (doorlopendSaldo == null || m.kasmutatie == null) {
        m.beginsaldo = doorlopendSaldo;
        m.eindsaldo = null;
        m.onderMinimum = null;
        doorlopendSaldo = null;
        continue;
      }
      m.beginsaldo = round2(doorlopendSaldo);
      m.eindsaldo = round2(doorlopendSaldo + m.kasmutatie);
      m.onderMinimum = instellingen.minimumKasbuffer == null
        ? false
        : m.eindsaldo < instellingen.minimumKasbuffer;
      doorlopendSaldo = m.eindsaldo;

      if (laagsteSaldo == null || m.eindsaldo < laagsteSaldo) {
        laagsteSaldo = m.eindsaldo;
        laagsteMaand = m.maand;
      }
    }

    const ontbrekendeConfiguratie = [...new Set(
      maanden.flatMap((m) => m.ontbrekendeConfiguratie)
    )];
    const compleet = maanden.every((m) => m.compleet && m.kasmutatie != null);

    jaren.push({
      jaar,
      compleet,
      ontbrekendeConfiguratie,
      beginsaldo: jaarBeginsaldo,
      eindsaldo: compleet ? doorlopendSaldo : null,
      laagsteSaldo: compleet ? laagsteSaldo : null,
      laagsteMaand: compleet ? laagsteMaand : null,
      minimumKasbuffer: instellingen.minimumKasbuffer,
      vpbPlanning,
      maanden,
      btwKwartalen,
    });

    const q4 = btwKwartalen.find((q) => q.kwartaal === 4);
    vorigeQ4Afdracht = q4?.modelAfdracht ?? null;
    vorigeVpbPlanning = vpbPlanning;
  }

  const ontbrekendAlleJaren = [...new Set(jaren.flatMap((j) => j.ontbrekendeConfiguratie))];
  if (ontbrekendAlleJaren.length) {
    waarschuwingen.push(`Meerjarenberekening wacht op configuratie: ${ontbrekendAlleJaren.join("; ")}.`);
  }

  waarschuwingen.push(
    `VPB-planning gebruikt vanaf fase 4R-A de fiscale winstmarge uit jaarrekening ${VPB_REFERENTIE_JAAR} (${round2(VPB_REFERENTIE_WINSTMARGE * 100)}%) als hoofdgrondslag, verminderd met managementfees en verhoogd met de expliciete managerbesparing. De kasstroom-afgeleide winst blijft alleen als controle zichtbaar.`
  );
  waarschuwingen.push(
    `VPB-tariefplanning gebruikt de ${VPB_TARIEF_BRONJAAR}-tarieven (${VPB_LAAG_PCT}% t/m €${VPB_DREMPEL.toLocaleString("nl-NL")}, daarboven ${VPB_HOOG_PCT}%) en boekt de geraamde VPB in augustus van het volgende jaar als kasuitgave.`
  );
  waarschuwingen.push(
    `Toekomstige reguliere loonkosten gebruiken het zelflerende gewogen omzetpercentage uit afgesloten werkelijke maanden. Managercorrectie: ${round2(BESPAARDE_UREN_PER_MANAGER_PER_MAAND)} vervallen personeelsuren per fulltime manager per maand in maart-september.`
  );

  return {
    vanafJaar: huidigJaar,
    totJaar,
    beschikbaar: jaren.every((j) => j.compleet),
    reden: jaren.every((j) => j.compleet) ? null : "Een of meer toekomstige maanden missen verplichte configuratie",
    instellingen: {
      ...instellingen,
      vpb: {
        tariefBronJaar: VPB_TARIEF_BRONJAAR,
        drempel: VPB_DREMPEL,
        laagPct: VPB_LAAG_PCT,
        hoogPct: VPB_HOOG_PCT,
        betaalmaandVolgendJaar: VPB_BETAALMAAND_VOLGEND_JAAR,
        kasEffectActief: true,
        methode: "fiscale_referentie_2025",
        referentieJaar: VPB_REFERENTIE_JAAR,
        referentieOpbrengsten: VPB_REFERENTIE_OPBRENGSTEN,
        referentieWinst: VPB_REFERENTIE_WINST,
        referentieWinstmargePct: round2(VPB_REFERENTIE_WINSTMARGE * 100),
      },
    },
    waarschuwingen: [...new Set(waarschuwingen)],
    loonkostenModel: {
      leerbasis: loonkostenLeerModel,
      personeelsUurkosten,
      managerAannames: {
        dagenPerWeek: MANAGER_DAGEN_PER_WEEK,
        urenPerDag: MANAGER_UREN_PER_DAG,
        productiefPct: MANAGER_PRODUCTIEF_PCT,
        vervangingPct: MANAGER_VERVANGING_PCT,
        bespaardeUrenPerManagerPerMaand: round2(
          BESPAARDE_UREN_PER_MANAGER_PER_MAAND
        ),
        robertFulltimeVanJaar: ROBERT_FULLTIME_VAN_JAAR,
        emoFulltimeVanJaar: EMO_FULLTIME_VAN_JAAR,
        maanden: MANAGER_CORRECTIE_MAANDEN,
      },
    },
    basisjaar: {
      jaar: huidigJaar,
      peildatum: basis.cashPositie.peildatum,
      prognoseGrens: basis.prognoseGrens,
      herijking: basisHerijking,
      startsaldo: basis.cashPositie.startsaldoTotaal,
      eindsaldo: basis.cashPositie.eindsaldo,
      laagsteSaldo: basis.cashPositie.laagsteSaldo,
      laagsteMaand: basis.cashPositie.laagsteMaand,
      q4BtwAfdracht: basisQ4Afdracht,
      vpbPlanning: basisVpbPlanning,
      maanden: basis.maanden,
      btwKwartalen: basis.btwKwartalen,
    },
    jaren,
  };
}
