// src/app/api/admin/briefing/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BriefingStatus = "ok" | "leeg" | "fout" | "niet_gekoppeld";

type BriefingOnderdeel<T> = {
  status: BriefingStatus;
  data: T;
  melding?: string;
};

type WeerUur = {
  tijd: string;
  uur: string;
  temperatuur: number | null;
  neerslagKans: number | null;
  neerslagMm: number | null;
  windKmh: number | null;
};

function vandaagAmsterdamIso() {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

function formatDatumLang(datum: string) {
  const date = new Date(`${datum}T12:00:00`);
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function veiligGetal(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

async function haalWeerOp(datum: string): Promise<BriefingOnderdeel<{
  locatie: string;
  periode: string;
  uren: WeerUur[];
  samenvatting: string;
  drukteverwachting: string;
}>> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");

    url.searchParams.set("latitude", "51.8425");
    url.searchParams.set("longitude", "5.8528");
    url.searchParams.set("timezone", "Europe/Amsterdam");
    url.searchParams.set("start_date", datum);
    url.searchParams.set("end_date", datum);
    url.searchParams.set(
      "hourly",
      [
        "temperature_2m",
        "precipitation_probability",
        "precipitation",
        "wind_speed_10m",
      ].join(",")
    );

    const res = await fetch(url.toString(), {
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        status: "fout",
        data: {
          locatie: "Nijmegen",
          periode: "12:00–22:00",
          uren: [],
          samenvatting: "Weer kon niet worden opgehaald.",
          drukteverwachting: "Geen drukteverwachting beschikbaar.",
        },
        melding: `Open-Meteo gaf status ${res.status}`,
      };
    }

    const json = await res.json();

    const tijden: string[] = json?.hourly?.time || [];
    const temperaturen: unknown[] = json?.hourly?.temperature_2m || [];
    const neerslagKansen: unknown[] = json?.hourly?.precipitation_probability || [];
    const neerslagMm: unknown[] = json?.hourly?.precipitation || [];
    const wind: unknown[] = json?.hourly?.wind_speed_10m || [];

    const uren: WeerUur[] = tijden
      .map((tijd, index) => {
        const uur = tijd.slice(11, 16);

        return {
          tijd,
          uur,
          temperatuur: veiligGetal(temperaturen[index]),
          neerslagKans: veiligGetal(neerslagKansen[index]),
          neerslagMm: veiligGetal(neerslagMm[index]),
          windKmh: veiligGetal(wind[index]),
        };
      })
      .filter((item) => item.uur >= "12:00" && item.uur <= "22:00");

    if (uren.length === 0) {
      return {
        status: "leeg",
        data: {
          locatie: "Nijmegen",
          periode: "12:00–22:00",
          uren: [],
          samenvatting: "Geen weerdata gevonden voor 12:00–22:00.",
          drukteverwachting: "Geen drukteverwachting beschikbaar.",
        },
      };
    }

    const temperaturenBekend = uren
      .map((uur) => uur.temperatuur)
      .filter((value): value is number => value !== null);

    const regenKansenBekend = uren
      .map((uur) => uur.neerslagKans)
      .filter((value): value is number => value !== null);

    const minTemp =
      temperaturenBekend.length > 0 ? Math.round(Math.min(...temperaturenBekend)) : null;
    const maxTemp =
      temperaturenBekend.length > 0 ? Math.round(Math.max(...temperaturenBekend)) : null;
    const maxRegenKans =
      regenKansenBekend.length > 0 ? Math.max(...regenKansenBekend) : null;

    const natteUren = uren.filter(
      (uur) =>
        (uur.neerslagKans !== null && uur.neerslagKans >= 40) ||
        (uur.neerslagMm !== null && uur.neerslagMm >= 0.5)
    );

    const eersteNatUur = natteUren[0]?.uur || null;

    let samenvatting = "Weerdata beschikbaar.";
    let drukteverwachting = "Normale drukteverwachting.";

    if (minTemp !== null && maxTemp !== null) {
      if (maxRegenKans !== null && maxRegenKans >= 50 && eersteNatUur) {
        samenvatting = `${minTemp}–${maxTemp}°C tussen 12:00 en 22:00. Verhoogde kans op regen vanaf ongeveer ${eersteNatUur}.`;
        drukteverwachting =
          "Middag mogelijk goed, maar avond kan rustiger worden door regenrisico.";
      } else if (maxTemp >= 22 && (maxRegenKans === null || maxRegenKans < 35)) {
        samenvatting = `${minTemp}–${maxTemp}°C tussen 12:00 en 22:00. Grotendeels geschikt terrasweer.`;
        drukteverwachting =
          "Kans op extra drukte in de middag en vroege avond, vooral tussen 14:00 en 17:00.";
      } else if (maxTemp >= 18 && (maxRegenKans === null || maxRegenKans < 45)) {
        samenvatting = `${minTemp}–${maxTemp}°C tussen 12:00 en 22:00. Redelijk terrasweer.`;
        drukteverwachting =
          "Redelijke drukte mogelijk, afhankelijk van zon en wind.";
      } else {
        samenvatting = `${minTemp}–${maxTemp}°C tussen 12:00 en 22:00. Beperkt terrasweer.`;
        drukteverwachting =
          "Geen duidelijke extra drukte verwacht op basis van het weer.";
      }
    }

    return {
      status: "ok",
      data: {
        locatie: "Nijmegen",
        periode: "12:00–22:00",
        uren,
        samenvatting,
        drukteverwachting,
      },
    };
  } catch (error) {
    return {
      status: "fout",
      data: {
        locatie: "Nijmegen",
        periode: "12:00–22:00",
        uren: [],
        samenvatting: "Weer kon niet worden opgehaald.",
        drukteverwachting: "Geen drukteverwachting beschikbaar.",
      },
      melding: String(error),
    };
  }
}

async function haalSollicitantenOp(
  datum: string,
  origin: string
): Promise<BriefingOnderdeel<any[]>> {
  try {
    /**
     * Eerste koppeling via bestaande Calendly-vandaag endpoint.
     * Dit voorkomt dat we afhankelijk zijn van kolommen in de sollicitaties-tabel
     * die mogelijk niet bestaan.
     */
    const vandaag = vandaagAmsterdamIso();

    if (datum !== vandaag) {
      return {
        status: "niet_gekoppeld",
        data: [],
        melding:
          "Sollicitatieafspraken zijn voorlopig alleen gekoppeld voor vandaag via Calendly.",
      };
    }

    const url = new URL("/api/calendly/vandaag", origin);

    const res = await fetch(url.toString(), {
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        status: "fout",
        data: [],
        melding: `Calendly-vandaag kon niet worden opgehaald. Status: ${res.status}`,
      };
    }

    const json = await res.json();

    const afspraken =
      Array.isArray(json)
        ? json
        : Array.isArray(json?.afspraken)
          ? json.afspraken
          : Array.isArray(json?.items)
            ? json.items
            : Array.isArray(json?.events)
              ? json.events
              : Array.isArray(json?.data)
                ? json.data
                : [];

    return {
      status: afspraken.length > 0 ? "ok" : "leeg",
      data: afspraken,
    };
  } catch (error) {
    return {
      status: "fout",
      data: [],
      melding: `Sollicitatieafspraken konden niet worden opgehaald: ${String(error)}`,
    };
  }
}

async function haalHaccpOp(datum: string): Promise<BriefingOnderdeel<{
  openTaken: any[];
  overdueTaken: any[];
}>> {
  try {
    /**
     * Eerste veilige basis.
     * Deze query gaat uit van een bestaande HACCP-log/routine structuur.
     * Als de actuele tabelnamen anders zijn, blijft alleen dit blok op fout staan.
     */
    const openTaken = await db.query(
      `
      SELECT *
      FROM haccp_taken
      WHERE actief = true
      LIMIT 0
      `
    );

    return {
      status: "niet_gekoppeld",
      data: {
        openTaken: openTaken.rows,
        overdueTaken: [],
      },
      melding:
        "HACCP is als blok aanwezig, maar moet nog exact gekoppeld worden aan de actuele routinetabellen.",
    };
  } catch (error) {
    return {
      status: "niet_gekoppeld",
      data: {
        openTaken: [],
        overdueTaken: [],
      },
      melding:
        "HACCP is als blok aanwezig, maar nog niet gekoppeld aan de actuele routinetabellen.",
    };
  }
}

async function haalPersoneelOp(datum: string): Promise<BriefingOnderdeel<{
  ingepland: any[];
  openShifts: any[];
  klokurenGoedTeKeuren: {
    aantal: number | null;
    oudsteDatum: string | null;
  };
  jarigVandaag: any[];
}>> {
  return {
    status: "niet_gekoppeld",
    data: {
      ingepland: [],
      openShifts: [],
      klokurenGoedTeKeuren: {
        aantal: null,
        oudsteDatum: null,
      },
      jarigVandaag: [],
    },
    melding:
      "Personeelblok staat klaar, maar Shiftbase/klokuren/verjaardagen worden in de volgende stap exact gekoppeld.",
  };
}

async function haalBijzonderhedenOp(datum: string): Promise<BriefingOnderdeel<{
  feestdag: string | null;
  schoolvakantie: string | null;
  evenementen: any[];
  opmerkingen: any[];
}>> {
  return {
    status: "niet_gekoppeld",
    data: {
      feestdag: null,
      schoolvakantie: null,
      evenementen: [],
      opmerkingen: [],
    },
    melding:
      "Bijzonderhedenblok staat klaar. Feestdagen, vakanties en evenementen worden later gekoppeld.",
  };
}

export async function GET(req: NextRequest) {
  const datum = req.nextUrl.searchParams.get("datum") || vandaagAmsterdamIso();

  const [
    weer,
    personeel,
    sollicitanten,
    haccp,
    bijzonderheden,
  ] = await Promise.all([
    haalWeerOp(datum),
    haalPersoneelOp(datum),
    haalSollicitantenOp(datum, req.nextUrl.origin),
    haalHaccpOp(datum),
    haalBijzonderhedenOp(datum),
  ]);

  return NextResponse.json({
    success: true,
    datum,
    datumLabel: formatDatumLang(datum),
    titel: "Dagbriefing Vincenzo",
    gegenereerdOp: new Date().toISOString(),
    onderdelen: {
      weer,
      personeel,
      sollicitanten,
      haccp,
      bijzonderheden,
    },
  });
}