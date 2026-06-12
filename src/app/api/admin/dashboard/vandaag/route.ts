import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dbRapportage } from "@/lib/dbRapportage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Status = "goed" | "waarschuwing" | "neutraal" | "onbekend";

type DashboardItem = {
  titel: string;
  waarde: string | number | null;
  subtitel: string;
  href?: string;
  status: Status;
};

function euro(value: number | null) {
  if (value === null || Number.isNaN(value)) return null;
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function datumNl(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
}

async function omzetVandaag(): Promise<DashboardItem> {
  try {
    const result = await dbRapportage.query(`
      WITH laatste AS (
        SELECT MAX(datum::date) AS datum
        FROM rapportage.omzet
      )
      SELECT
        l.datum,
        COALESCE(SUM((o.aantal::numeric) * (o.eenheidsprijs::numeric)), 0) AS omzet
      FROM laatste l
      LEFT JOIN rapportage.omzet o ON o.datum::date = l.datum
      GROUP BY l.datum
    `);

    const row = result.rows[0];
    const omzet = row?.omzet === null || row?.omzet === undefined ? null : Number(row.omzet);
    const laatsteDatum = row?.datum || null;

    return {
      titel: "Omzet",
      waarde: euro(omzet),
      subtitel: laatsteDatum
        ? `Laatste omzetdatum: ${datumNl(laatsteDatum)}`
        : "Nog geen omzetdata gevonden.",
      href: "/admin/rapportage/omzet",
      status: omzet !== null ? "neutraal" : "onbekend",
    };
  } catch (error) {
    console.error("Dashboard omzet kon niet geladen worden:", error);
    return {
      titel: "Omzet",
      waarde: null,
      subtitel: "Omzetkoppeling nog niet beschikbaar op dit dashboard.",
      href: "/admin/rapportage/omzet",
      status: "onbekend",
    };
  }
}

async function productieVandaag(): Promise<DashboardItem> {
  try {
    const result = await db.query(`
      SELECT COALESCE(SUM(aantal::numeric), 0) AS aantal
      FROM ijs_productie
      WHERE datum::date = CURRENT_DATE
    `);

    const aantal = Number(result.rows[0]?.aantal || 0);
    return {
      titel: "Productie",
      waarde: aantal,
      subtitel: aantal === 1 ? "bak/productie vandaag geregistreerd" : "bakken/producties vandaag geregistreerd",
      href: "/admin/suikervrij",
      status: aantal > 0 ? "neutraal" : "onbekend",
    };
  } catch (error) {
    console.error("Dashboard productie kon niet geladen worden:", error);
    return {
      titel: "Productie",
      waarde: null,
      subtitel: "Maaklijst/productie-openstaand nog koppelen.",
      href: "/keuken/maaklijst",
      status: "onbekend",
    };
  }
}

async function haccpVandaag(): Promise<DashboardItem> {
  // Eerste veilige versie: nog niet hard koppelen aan HACCP-tabellen, omdat die per installatie kunnen verschillen.
  return {
    titel: "HACCP",
    waarde: null,
    subtitel: "Open HACCP-taken nog koppelen aan de bestaande routine-API.",
    href: "/admin/haccp",
    status: "onbekend",
  };
}

async function medewerkersVandaag(): Promise<DashboardItem> {
  return {
    titel: "Medewerkers vandaag",
    waarde: null,
    subtitel: "Rooster/Shiftbase-koppeling nog aansluiten.",
    href: "/admin/planning/rooster",
    status: "onbekend",
  };
}

async function openShifts(): Promise<DashboardItem> {
  return {
    titel: "Open shifts",
    waarde: null,
    subtitel: "Open diensten nog koppelen aan Shiftbase/open-shifts.",
    href: "/open-diensten",
    status: "onbekend",
  };
}

async function weer(): Promise<DashboardItem> {
  return {
    titel: "Weer & terras",
    waarde: null,
    subtitel: "Weer/terrasindicatie nog koppelen aan dagbriefing of weerbron.",
    status: "onbekend",
  };
}

export async function GET() {
  const now = new Date();

  const [omzet, productie, haccp, medewerkers, shifts, weerItem] = await Promise.all([
    omzetVandaag(),
    productieVandaag(),
    haccpVandaag(),
    medewerkersVandaag(),
    openShifts(),
    weer(),
  ]);

  return NextResponse.json({
    datumLabel: now.toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    bijgewerktOp: now.toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    items: {
      omzet,
      weer: weerItem,
      medewerkers,
      openShifts: shifts,
      haccp,
      productie,
    },
  });
}
