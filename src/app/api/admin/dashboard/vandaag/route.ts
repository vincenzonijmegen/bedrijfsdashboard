import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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

function vandaagIso() {
  return new Date().toISOString().slice(0, 10);
}

function tijdNl() {
  return new Date().toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function haalArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.open_shifts)) return data.open_shifts;
  if (Array.isArray(data?.timesheets)) return data.timesheets;
  return [];
}

async function shiftbaseFetch(path: string, params?: Record<string, string>) {
  const apiKey = process.env.SHIFTBASE_API_KEY?.trim();
  if (!apiKey) throw new Error("SHIFTBASE_API_KEY ontbreekt");

  const url = new URL(`https://api.shiftbase.com/api/${path.replace(/^\//, "")}`);
  Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, value));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `API ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const details = await res.text();
    throw new Error(`Shiftbase ${path} gaf ${res.status}: ${details}`);
  }

  return res.json();
}

async function weer(): Promise<DashboardItem> {
  try {
    // Nijmegen centrum, zonder API-key via Open-Meteo.
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", "51.8425");
    url.searchParams.set("longitude", "5.8528");
    url.searchParams.set("current", "temperature_2m,precipitation,wind_speed_10m");
    url.searchParams.set("hourly", "precipitation_probability");
    url.searchParams.set("forecast_days", "1");
    url.searchParams.set("timezone", "Europe/Amsterdam");

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();

    const temp = Math.round(Number(json.current?.temperature_2m));
    const regenNu = Number(json.current?.precipitation || 0);
    const wind = Math.round(Number(json.current?.wind_speed_10m || 0));
    const kansen: number[] = (json.hourly?.precipitation_probability || []).map((v: any) => Number(v));
    const maxRegenKans = kansen.length ? Math.max(...kansen) : 0;

    let terras = "goed terrasweer";
    let status: Status = "goed";
    if (regenNu > 0 || maxRegenKans >= 60 || wind >= 35) {
      terras = "terras minder gunstig";
      status = "waarschuwing";
    } else if (temp < 16 || maxRegenKans >= 35) {
      terras = "terras twijfelachtig";
      status = "neutraal";
    }

    return {
      titel: "Weer & terras",
      waarde: Number.isFinite(temp) ? `${temp}°C` : null,
      subtitel: `${terras}. Regenkans max. ${maxRegenKans}% · wind ${wind} km/u`,
      status,
    };
  } catch (error) {
    console.error("Dashboard weer kon niet geladen worden:", error);
    return {
      titel: "Weer & terras",
      waarde: null,
      subtitel: "Weerbron kon niet geladen worden.",
      status: "onbekend",
    };
  }
}

async function openShifts(): Promise<DashboardItem> {
  try {
    const vandaag = vandaagIso();
    const data = await shiftbaseFetch("open_shifts", {
      from: vandaag,
      to: vandaag,
      start_date: vandaag,
      end_date: vandaag,
    });
    const rows = haalArray(data);
    const aantal = rows.length;

    return {
      titel: "Open shifts",
      waarde: aantal,
      subtitel: aantal === 0 ? "Geen open diensten gevonden voor vandaag." : `${aantal} open dienst(en) in Shiftbase.`,
      href: "/openshifts",
      status: aantal > 0 ? "waarschuwing" : "goed",
    };
  } catch (error) {
    console.error("Dashboard open shifts kon niet geladen worden:", error);
    return {
      titel: "Open shifts",
      waarde: null,
      subtitel: "Open diensten konden niet uit Shiftbase worden geladen.",
      href: "/openshifts",
      status: "onbekend",
    };
  }
}

async function medewerkersVandaag(): Promise<DashboardItem> {
  try {
    const vandaag = vandaagIso();
    const data = await shiftbaseFetch("timesheets", {
      from: vandaag,
      to: vandaag,
      start_date: vandaag,
      end_date: vandaag,
      date: vandaag,
    });

    const rows = haalArray(data);
    const medewerkers = new Set<string>();

    for (const row of rows) {
      const id =
        row?.employee_id ||
        row?.Employee?.id ||
        row?.employee?.id ||
        row?.user_id ||
        row?.User?.id ||
        row?.name ||
        row?.Employee?.name ||
        row?.employee_name;
      if (id) medewerkers.add(String(id));
    }

    const aantal = medewerkers.size || rows.length;

    return {
      titel: "Medewerkers vandaag",
      waarde: aantal,
      subtitel: aantal === 0 ? "Nog geen Shiftbase-bezetting/timesheets gevonden." : `${aantal} medewerker(s) gevonden in Shiftbase.`,
      href: "/admin/planning/rooster",
      status: aantal > 0 ? "neutraal" : "onbekend",
    };
  } catch (error) {
    console.error("Dashboard medewerkers vandaag kon niet geladen worden:", error);
    return {
      titel: "Medewerkers vandaag",
      waarde: null,
      subtitel: "Rooster/timesheets konden niet uit Shiftbase worden geladen.",
      href: "/admin/planning/rooster",
      status: "onbekend",
    };
  }
}

async function haccpVandaag(): Promise<DashboardItem> {
  try {
    // Voorlopige veilige koppeling op de bestaande routine-structuur:
    // actieve routines waarvan de laatste uitvoering ontbreekt of ouder is dan frequentie-dagen.
    const result = await db.query(`
      SELECT COUNT(*)::int AS open
      FROM schoonmaakroutines
      WHERE actief = true
        AND EXTRACT(MONTH FROM CURRENT_DATE)::int BETWEEN periode_start AND periode_eind
        AND (
          laatst_uitgevoerd IS NULL
          OR laatst_uitgevoerd::date <= CURRENT_DATE - (frequentie::int * INTERVAL '1 day')
        )
    `);

    const open = Number(result.rows[0]?.open || 0);
    return {
      titel: "HACCP",
      waarde: open,
      subtitel: open === 0 ? "Geen open periodieke routines gevonden." : `${open} routine(s) vragen aandacht.`,
      href: "/admin/schoonmaakroutines",
      status: open > 0 ? "waarschuwing" : "goed",
    };
  } catch (error) {
    console.error("Dashboard HACCP/routines kon niet geladen worden:", error);
    return {
      titel: "HACCP",
      waarde: null,
      subtitel: "HACCP/routine-koppeling kon niet geladen worden.",
      href: "/admin/schoonmaakroutines",
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
      subtitel: "Productiegegevens konden niet geladen worden.",
      href: "/keuken/maaklijst",
      status: "onbekend",
    };
  }
}

export async function GET() {
  const now = new Date();

  const [weerItem, medewerkers, shifts, haccp, productie] = await Promise.all([
    weer(),
    medewerkersVandaag(),
    openShifts(),
    haccpVandaag(),
    productieVandaag(),
  ]);

  return NextResponse.json({
    datumLabel: now.toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    bijgewerktOp: tijdNl(),
    items: {
      weer: weerItem,
      medewerkers,
      openShifts: shifts,
      haccp,
      productie,
    },
  });
}
