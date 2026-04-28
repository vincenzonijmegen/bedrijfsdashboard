import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DagOmzetRow = {
  datum: Date;
  omzet: string | number | null;
};

type UurOmzetRow = {
  datum: Date;
  uur: string;
  omzet: string | number;
};

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getPreviousSundayToSaturday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const day = today.getDay(); // zondag = 0
  const afgelopenZondag = new Date(today);
  afgelopenZondag.setDate(today.getDate() - day - 7);

  const afgelopenZaterdag = new Date(afgelopenZondag);
  afgelopenZaterdag.setDate(afgelopenZondag.getDate() + 6);

  return {
    startDatum: formatDateOnly(afgelopenZondag),
    eindDatum: formatDateOnly(afgelopenZaterdag),
  };
}

function getWeatherDescription(code: number | null | undefined) {
  switch (code) {
    case 0:
      return "zonnig";
    case 1:
      return "overwegend zonnig";
    case 2:
      return "half bewolkt";
    case 3:
      return "bewolkt";
    case 45:
    case 48:
      return "mistig";
    case 51:
    case 53:
    case 55:
      return "motregen";
    case 61:
    case 63:
    case 65:
      return "regen";
    case 80:
    case 81:
    case 82:
      return "regenbuien";
    case 95:
      return "onweer";
    default:
      return "onbekend";
  }
}

async function getWeerVoorPeriode(startDatum: string, eindDatum: string) {
  const latitude = process.env.DAGRAPPORT_WEATHER_LAT ?? "51.8426";
  const longitude = process.env.DAGRAPPORT_WEATHER_LON ?? "5.8518";

  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${encodeURIComponent(latitude)}` +
    `&longitude=${encodeURIComponent(longitude)}` +
    `&start_date=${encodeURIComponent(startDatum)}` +
    `&end_date=${encodeURIComponent(eindDatum)}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&timezone=Europe%2FAmsterdam`;

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return new Map();

    const json = await response.json();
    const daily = json?.daily;

    const map = new Map();

    if (!daily?.time) return map;

    for (let i = 0; i < daily.time.length; i++) {
      const code = Number(daily.weather_code?.[i]);
      const maxTemp = Number(daily.temperature_2m_max?.[i]);
      const minTemp = Number(daily.temperature_2m_min?.[i]);
      const neerslag = Number(daily.precipitation_sum?.[i]);

      map.set(daily.time[i], {
        omschrijving: getWeatherDescription(code),
        minTemp: Number.isFinite(minTemp) ? minTemp : null,
        maxTemp: Number.isFinite(maxTemp) ? maxTemp : null,
        neerslag: Number.isFinite(neerslag) ? neerslag : null,
      });
    }

    return map;
  } catch {
    return new Map();
  }
}

export async function GET() {
  try {
    const { startDatum, eindDatum } = getPreviousSundayToSaturday();

    const [omzetResult, omzetPerUurResult, weerMap] = await Promise.all([
      db.query(
        `
        SELECT
          datum::date AS datum,
          ROUND(SUM(aantal * eenheidsprijs)) AS omzet
        FROM rapportage.omzet
        WHERE datum >= $1::date
          AND datum <= $2::date
        GROUP BY datum::date
        ORDER BY datum::date ASC
        `,
        [startDatum, eindDatum]
      ),
      db.query(
        `
        SELECT
          datum::date AS datum,
          TO_CHAR(tijdstip, 'HH24:00') AS uur,
          ROUND(COALESCE(SUM(aantal * eenheidsprijs), 0)) AS omzet
        FROM rapportage.omzet
        WHERE datum >= $1::date
          AND datum <= $2::date
        GROUP BY datum::date, TO_CHAR(tijdstip, 'HH24:00')
        ORDER BY datum::date ASC, TO_CHAR(tijdstip, 'HH24:00') ASC
        `,
        [startDatum, eindDatum]
      ),
      getWeerVoorPeriode(startDatum, eindDatum),
    ]);

    const omzetPerDag = new Map<string, number>();

    for (const row of omzetResult.rows as DagOmzetRow[]) {
      const datum = row.datum.toISOString().slice(0, 10);
      omzetPerDag.set(datum, Number(row.omzet || 0));
    }

    const uurMap = new Map<string, { uur: string; omzet: number }[]>();

    for (const row of omzetPerUurResult.rows as UurOmzetRow[]) {
      const datum = row.datum.toISOString().slice(0, 10);

      if (!uurMap.has(datum)) {
        uurMap.set(datum, []);
      }

      uurMap.get(datum)!.push({
        uur: row.uur,
        omzet: Number(row.omzet || 0),
      });
    }

    const dagen = [];
    const start = new Date(`${startDatum}T00:00:00`);

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);

      const datum = formatDateOnly(d);
      const omzetPerUur = uurMap.get(datum) || [];
      const druksteUur =
        [...omzetPerUur].sort((a, b) => b.omzet - a.omzet)[0] || null;

      dagen.push({
        datum,
        omzet: omzetPerDag.get(datum) || 0,
        weer: weerMap.get(datum) || null,
        omzetPerUur,
        druksteUur,
      });
    }

    const totaalOmzet = dagen.reduce((sum, dag) => sum + dag.omzet, 0);
    const gemiddeldeOmzet = dagen.length
      ? Math.round(totaalOmzet / dagen.length)
      : 0;
    const besteDag = [...dagen].sort((a, b) => b.omzet - a.omzet)[0] || null;

    return NextResponse.json({
      success: true,
      startDatum,
      eindDatum,
      dagen,
      totaalOmzet,
      gemiddeldeOmzet,
      besteDag: besteDag
        ? {
            datum: besteDag.datum,
            omzet: besteDag.omzet,
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Fout bij ophalen weekrapport",
        details: String(error),
      },
      { status: 500 }
    );
  }
}