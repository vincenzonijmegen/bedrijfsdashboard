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

type WeerUur = {
  tijd: string;
  uur: string;
  temperatuur: number | null;
  neerslagMm: number | null;
  windKmh: number | null;
};

function vandaagIso() {
  return new Date().toISOString().slice(0, 10);
}

function tijdNl() {
  return new Date().toLocaleTimeString("nl-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function veiligGetal(value: unknown): number | null {
  const getal = Number(value);
  return Number.isFinite(getal) ? getal : null;
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
    const vandaag = vandaagIso();

    // Nijmegen centrum, zonder API-key via Open-Meteo.
    const url = new URL("https://api.open-meteo.com/v1/forecast");

    url.searchParams.set("latitude", "51.8425");
    url.searchParams.set("longitude", "5.8528");
    url.searchParams.set("timezone", "Europe/Amsterdam");
    url.searchParams.set("start_date", vandaag);
    url.searchParams.set("end_date", vandaag);
    url.searchParams.set(
      "hourly",
      [
        "temperature_2m",
        "precipitation_probability",
        "precipitation",
        "wind_speed_10m",
      ].join(",")
    );

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());

    const json = await res.json();

    const tijden: string[] = json?.hourly?.time || [];
    const temperaturen: unknown[] = json?.hourly?.temperature_2m || [];
    const neerslagMm: unknown[] = json?.hourly?.precipitation || [];
    const wind: unknown[] = json?.hourly?.wind_speed_10m || [];

    const uren: WeerUur[] = tijden
      .map((tijd, index) => {
        const uur = tijd.slice(11, 16);

        return {
          tijd,
          uur,
          temperatuur: veiligGetal(temperaturen[index]),
          neerslagMm: veiligGetal(neerslagMm[index]),
          windKmh: veiligGetal(wind[index]),
        };
      })
      .filter((item) => item.uur >= "12:00" && item.uur <= "22:00");

    if (uren.length === 0) {
      return {
        titel: "Weer & terras",
        waarde: null,
        subtitel: "Geen weerdata gevonden voor 12:00–22:00.",
        status: "onbekend",
      };
    }

    const temperaturenBekend = uren
      .map((uur) => uur.temperatuur)
      .filter((value): value is number => value !== null);

    const neerslagBekend = uren
      .map((uur) => uur.neerslagMm)
      .filter((value): value is number => value !== null);

    const windBekend = uren
      .map((uur) => uur.windKmh)
      .filter((value): value is number => value !== null);

    const minTemp =
      temperaturenBekend.length > 0
        ? Math.round(Math.min(...temperaturenBekend))
        : null;

    const maxTemp =
      temperaturenBekend.length > 0
        ? Math.round(Math.max(...temperaturenBekend))
        : null;

    const maxWind =
      windBekend.length > 0
        ? Math.round(Math.max(...windBekend))
        : null;

    const totaleNeerslagMm =
      neerslagBekend.length > 0
        ? neerslagBekend.reduce((som, waarde) => som + waarde, 0)
        : 0;

    const natteUren = uren.filter(
      (uur) => uur.neerslagMm !== null && uur.neerslagMm >= 0.5
    );

    const eersteNatUur = natteUren[0]?.uur || null;

    const neerslagTekst = `${totaleNeerslagMm
      .toFixed(1)
      .replace(".", ",")} mm`;

    let subtitel = "Weerdata beschikbaar.";
    let status: Status = "neutraal";

    if (minTemp !== null && maxTemp !== null) {
      if (totaleNeerslagMm >= 2 && eersteNatUur) {
        subtitel = `${minTemp}–${maxTemp}°C. Regen vanaf ongeveer ${eersteNatUur} · totaal ${neerslagTekst}`;
        status = "waarschuwing";
      } else if (maxTemp >= 22 && totaleNeerslagMm < 1) {
        subtitel = `${minTemp}–${maxTemp}°C. Goed terrasweer, vrijwel droog.`;
        status = "goed";
      } else if (maxTemp >= 18 && totaleNeerslagMm < 1.5) {
        subtitel = `${minTemp}–${maxTemp}°C. Redelijk terrasweer, ${neerslagTekst} neerslag.`;
        status = "goed";
      } else {
        subtitel = `${minTemp}–${maxTemp}°C. Beperkt terrasweer, ${neerslagTekst} neerslag.`;
        status = "neutraal";
      }

      if (maxWind !== null && maxWind >= 35) {
        subtitel = `${subtitel} · wind ${maxWind} km/u`;
        status = "waarschuwing";
      }
    }

    return {
      titel: "Weer & terras",
      waarde:
        minTemp !== null && maxTemp !== null
          ? `${minTemp}–${maxTemp}°C`
          : null,
      subtitel,
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
      subtitel:
        aantal === 0
          ? "Geen open diensten gevonden voor vandaag."
          : `${aantal} open dienst(en) in Shiftbase.`,
      href: "/open-diensten",
      status: aantal > 0 ? "waarschuwing" : "goed",
    };
  } catch (error) {
    console.error("Dashboard open shifts kon niet geladen worden:", error);
    return {
      titel: "Open shifts",
      waarde: null,
      subtitel: "Open diensten konden niet uit Shiftbase worden geladen.",
      href: "/open-diensten",
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
      subtitel:
        aantal === 0
          ? "Nog geen Shiftbase-bezetting/timesheets gevonden."
          : `${aantal} medewerker(s) gevonden in Shiftbase.`,
      href: "/admin/shiftbase/rooster",
      status: aantal > 0 ? "neutraal" : "onbekend",
    };
  } catch (error) {
    console.error("Dashboard medewerkers vandaag kon niet geladen worden:", error);
    return {
      titel: "Medewerkers vandaag",
      waarde: null,
      subtitel: "Rooster/timesheets konden niet uit Shiftbase worden geladen.",
      href: "/admin/shiftbase/rooster",
      status: "onbekend",
    };
  }
}

async function haccpVandaag(): Promise<DashboardItem> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://werkinstructies-app.vercel.app";

    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/admin/briefing`, {
      cache: "no-store",
    });

    if (!res.ok) {
      const details = await res.text();
      throw new Error(`Briefing API gaf ${res.status}: ${details}`);
    }

    const json = await res.json();
    const haccp = json?.onderdelen?.haccp;

    if (haccp?.status !== "ok") {
      throw new Error(haccp?.melding || "HACCP-status niet ok");
    }

    const haccpData = haccp?.data || {};
    const openTaken = Array.isArray(haccpData.openTaken) ? haccpData.openTaken : [];
    const routines = Array.isArray(haccpData.routines) ? haccpData.routines : [];
    const samenvatting = haccpData.samenvatting || null;

    const routinesMetOpenTaken = routines.filter(
      (routine: any) => Number(routine.openTaken || 0) > 0
    );

    const aantalOpen = Number(samenvatting?.openTaken ?? openTaken.length);
    const aantalLijsten = routinesMetOpenTaken.length;

    return {
      titel: "HACCP",
      waarde: aantalOpen,
      subtitel:
        aantalOpen === 0
          ? "Alle HACCP-taken zijn afgerond."
          : `${aantalOpen} open taak/taken · ${aantalLijsten} lijst(en)`,
      href: "/admin/haccp-controle",
      status: aantalOpen > 0 ? "waarschuwing" : "goed",
    };
  } catch (error) {
    console.error("Dashboard HACCP kon niet geladen worden:", error);

    return {
      titel: "HACCP",
      waarde: null,
      subtitel: "HACCP-status kon niet geladen worden.",
      href: "/admin/haccp-controle",
      status: "onbekend",
    };
  }
}

async function productieVandaag(): Promise<DashboardItem> {
  try {
    const result = await db.query(`
      SELECT
        COALESCE(SUM(aantal::numeric), 0) AS totaal_gemaakt,
        COUNT(*)::int AS batches
      FROM keuken_productie_log
      WHERE afgehandeld_op::date = CURRENT_DATE
    `);

    const totaalGemaakt = Number(result.rows[0]?.totaal_gemaakt || 0);
    const batches = Number(result.rows[0]?.batches || 0);

    return {
      titel: "Productie",
      waarde: totaalGemaakt,
      subtitel:
        batches === 1
          ? "1 batch vandaag geregistreerd"
          : `${batches} batches vandaag geregistreerd`,
      href: "/admin/keuken/productie-log",
      status: totaalGemaakt > 0 ? "neutraal" : "onbekend",
    };
  } catch (error) {
    console.error("Dashboard productie kon niet geladen worden:", error);
    return {
      titel: "Productie",
      waarde: null,
      subtitel: "Productiegegevens konden niet geladen worden.",
      href: "/admin/keuken/productie-log",
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
      timeZone: "Europe/Amsterdam",
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