import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HaccpRow = {
  routine_id: number;
  routine_naam: string;
  routine_slug: string;
  locatie: string;
  type: string;
  taak_id: number;
  taak_naam: string;
  frequentie: "D" | "W" | "2D";
  weekdagen: string[] | null;
  sortering: number;
  afgetekend_door_naam: string | null;
  afgetekend_op: string | null;
};

type ProductieRow = {
  categorie: string;
  recept_naam: string;
  totaal: string | number;
};

type OmzetPerUurRow = {
  uur: string;
  omzet: string | number;
};

type DagomzetRow = {
  dagomzet: string | number | null;
};

const WEEKDAGEN = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const ISO_EVEN_REFERENCE = new Date("2026-01-05T00:00:00"); // maandag

function parseDatum(input: string | null): Date {
  if (!input) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  const d = new Date(`${input}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() - 1);
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }

  return d;
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dagenVerschil(a: Date, b: Date) {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcA - utcB) / 86400000);
}

function taakIsOpDatumZichtbaar(
  taak: Pick<HaccpRow, "frequentie" | "weekdagen">,
  datum: Date
) {
  const weekdagen = Array.isArray(taak.weekdagen) ? taak.weekdagen : [];
  const vandaagCode = WEEKDAGEN[datum.getDay()];

  if (weekdagen.length > 0 && !weekdagen.includes(vandaagCode)) {
    return false;
  }

  if (taak.frequentie === "2D") {
    return dagenVerschil(datum, ISO_EVEN_REFERENCE) % 2 === 0;
  }

  return true;
}

function getRoutineLabel(row: Pick<HaccpRow, "routine_naam" | "locatie" | "type">) {
  if (row.routine_naam) return row.routine_naam;

  const loc = row.locatie ? row.locatie.charAt(0).toUpperCase() + row.locatie.slice(1) : "";
  const type = row.type ? row.type.charAt(0).toUpperCase() + row.type.slice(1) : "";
  return `${type} ${loc}`.trim();
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
    case 56:
    case 57:
      return "ijzel";
    case 61:
    case 63:
    case 65:
      return "regen";
    case 66:
    case 67:
      return "ijzelregen";
    case 71:
    case 73:
    case 75:
      return "sneeuw";
    case 77:
      return "sneeuwkorrels";
    case 80:
    case 81:
    case 82:
      return "regenbuien";
    case 85:
    case 86:
      return "sneeuwbuien";
    case 95:
      return "onweer";
    case 96:
    case 99:
      return "onweer met hagel";
    default:
      return "onbekend";
  }
}

async function getWeerVanDag(datum: string) {
  const latitude = process.env.DAGRAPPORT_WEATHER_LAT ?? "51.8426";
  const longitude = process.env.DAGRAPPORT_WEATHER_LON ?? "5.8518";

  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${encodeURIComponent(latitude)}` +
    `&longitude=${encodeURIComponent(longitude)}` +
    `&start_date=${encodeURIComponent(datum)}` +
    `&end_date=${encodeURIComponent(datum)}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&timezone=Europe%2FAmsterdam`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();

    const daily = json?.daily;
    if (!daily) {
      return null;
    }

    const weatherCode = Array.isArray(daily.weather_code) ? daily.weather_code[0] : null;
    const maxTemp = Array.isArray(daily.temperature_2m_max)
      ? Number(daily.temperature_2m_max[0])
      : null;
    const minTemp = Array.isArray(daily.temperature_2m_min)
      ? Number(daily.temperature_2m_min[0])
      : null;
    const neerslag = Array.isArray(daily.precipitation_sum)
      ? Number(daily.precipitation_sum[0])
      : null;

    return {
      omschrijving: getWeatherDescription(
        typeof weatherCode === "number" ? weatherCode : Number(weatherCode)
      ),
      minTemp: Number.isFinite(minTemp) ? minTemp : null,
      maxTemp: Number.isFinite(maxTemp) ? maxTemp : null,
      neerslag: Number.isFinite(neerslag) ? neerslag : null,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const datumObj = parseDatum(req.nextUrl.searchParams.get("datum"));
    const datum = formatDateOnly(datumObj);

    const routineSlugs = [
      "keuken-opstart",
      "keuken-afsluit",
      "winkel-opstart",
      "winkel-afsluit",
    ];

    const haccpResult = await db.query(
      `
      SELECT
        r.id AS routine_id,
        r.naam AS routine_naam,
        r.slug AS routine_slug,
        r.locatie,
        r.type,
        t.id AS taak_id,
        t.naam AS taak_naam,
        t.frequentie,
        COALESCE(t.weekdagen, '[]'::jsonb) AS weekdagen,
        t.sortering,
        a.afgetekend_door_naam,
        a.afgetekend_op
      FROM routines r
      JOIN routine_taken t
        ON t.routine_id = r.id
       AND t.actief = true
      LEFT JOIN routine_aftekeningen a
        ON a.routine_taak_id = t.id
       AND a.datum = $1::date
      WHERE r.actief = true
        AND r.slug = ANY($2::text[])
      ORDER BY
        r.locatie ASC,
        r.type ASC,
        t.sortering ASC,
        t.id ASC
      `,
      [datum, routineSlugs]
    );

    const haccpRows = haccpResult.rows as HaccpRow[];

    const zichtbareHaccpRows = haccpRows.filter((row) =>
      taakIsOpDatumZichtbaar(row, datumObj)
    );

    const haccpMap = new Map<
      string,
      {
        routineId: number;
        routineNaam: string;
        routineSlug: string;
        locatie: string;
        type: string;
        compleet: boolean;
        totaalTaken: number;
        gedaanTaken: number;
        taken: {
          taakId: number;
          taakNaam: string;
          afgetekend: boolean;
          afgetekendDoorNaam: string | null;
          afgetekendOp: string | null;
        }[];
      }
    >();

    for (const row of zichtbareHaccpRows) {
      const key = row.routine_slug;

      if (!haccpMap.has(key)) {
        haccpMap.set(key, {
          routineId: row.routine_id,
          routineNaam: getRoutineLabel(row),
          routineSlug: row.routine_slug,
          locatie: row.locatie,
          type: row.type,
          compleet: true,
          totaalTaken: 0,
          gedaanTaken: 0,
          taken: [],
        });
      }

      const groep = haccpMap.get(key)!;
      const afgetekend = Boolean(row.afgetekend_op);

      groep.totaalTaken += 1;
      if (afgetekend) {
        groep.gedaanTaken += 1;
      } else {
        groep.compleet = false;
      }

      groep.taken.push({
        taakId: row.taak_id,
        taakNaam: row.taak_naam,
        afgetekend,
        afgetekendDoorNaam: row.afgetekend_door_naam,
        afgetekendOp: row.afgetekend_op,
      });
    }

    const haccp = Array.from(haccpMap.values()).sort((a, b) =>
      a.routineNaam.localeCompare(b.routineNaam, "nl")
    );

    const productieResult = await db.query(
      `
      SELECT
        categorie,
        recept_naam,
        SUM(aantal) AS totaal
      FROM keuken_productie_log
      WHERE afgehandeld_op >= $1::date
        AND afgehandeld_op < ($1::date + INTERVAL '1 day')
      GROUP BY categorie, recept_naam
      ORDER BY categorie ASC, SUM(aantal) DESC, recept_naam ASC
      `,
      [datum]
    );

    const productieRows = productieResult.rows as ProductieRow[];

    const productieMap = new Map<
      string,
      {
        categorie: string;
        totaal: number;
        items: {
          naam: string;
          aantal: number;
        }[];
      }
    >();

    for (const row of productieRows) {
      const categorie = row.categorie;
      const aantal = Number(row.totaal || 0);

      if (!productieMap.has(categorie)) {
        productieMap.set(categorie, {
          categorie,
          totaal: 0,
          items: [],
        });
      }

      const groep = productieMap.get(categorie)!;
      groep.totaal += aantal;
      groep.items.push({
        naam: row.recept_naam,
        aantal,
      });
    }

    const productie = Array.from(productieMap.values()).sort((a, b) =>
      a.categorie.localeCompare(b.categorie, "nl")
    );

    const [dagomzetResult, omzetPerUurResult, weer] = await Promise.all([
      db.query(
        `
        SELECT
          ROUND(COALESCE(SUM(aantal * eenheidsprijs), 0)) AS dagomzet
        FROM rapportage.omzet
        WHERE datum = $1::date
        `,
        [datum]
      ),
      db.query(
        `
        SELECT
          TO_CHAR(tijdstip, 'HH24:00') AS uur,
          ROUND(COALESCE(SUM(aantal * eenheidsprijs), 0)) AS omzet
        FROM rapportage.omzet
        WHERE datum = $1::date
        GROUP BY TO_CHAR(tijdstip, 'HH24:00')
        ORDER BY TO_CHAR(tijdstip, 'HH24:00')
        `,
        [datum]
      ),
      getWeerVanDag(datum),
    ]);

    const dagomzetRows = dagomzetResult.rows as DagomzetRow[];
    const dagomzet = Number(dagomzetRows[0]?.dagomzet || 0);

    const omzetPerUurRows = omzetPerUurResult.rows as OmzetPerUurRow[];
    const omzetPerUur = omzetPerUurRows.map((row) => ({
      uur: row.uur,
      omzet: Number(row.omzet || 0),
    }));

    return NextResponse.json({
      success: true,
      datum,
      dagomzet,
      weer,
      omzetPerUur,
      haccp,
      productie,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Fout bij ophalen dagrapport",
        details: String(error),
      },
      { status: 500 }
    );
  }
}