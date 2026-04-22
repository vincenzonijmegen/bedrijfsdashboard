import { NextResponse } from "next/server";
import { dbRapportage } from "@/lib/dbRapportage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type WeerApiResponse = {
  daily?: {
    time?: string[];
    weather_code?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    temperature_2m_max?: Array<number | null>;
    precipitation_sum?: Array<number | null>;
  };
};






function isISO(s?: string | null) {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toISO(d: string) {
  if (/^\d{2}-\d{2}-\d{4}$/.test(d)) {
    const [dd, mm, yyyy] = d.split("-");
    return `${yyyy}-${mm}-${dd}`;
  }
  return d;
}

function yearRange(y: number) {
  return [`${y}-01-01`, `${y}-12-31`] as const;
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

function dateDiffInDays(start: string, end: string) {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

async function ensureWeerRange(start: string, end: string) {
  const vandaag = new Date().toISOString().slice(0, 10);

  const fetchStart = start;
  let fetchEnd = end;

  // nooit voorbij vandaag ophalen
  if (fetchEnd > vandaag) {
    fetchEnd = vandaag;
  }

  // alles ligt in de toekomst -> niks doen
  if (fetchStart > vandaag) {
    return;
  }

  const expectedDays = dateDiffInDays(fetchStart, fetchEnd);

  const existing = await dbRapportage.query<{ count: string }>(
    `
    SELECT COUNT(*)::int AS count
    FROM rapportage.weer_per_dag
    WHERE datum BETWEEN $1 AND $2
    `,
    [fetchStart, fetchEnd]
  );

  const existingCount = Number(existing.rows[0]?.count ?? 0);

  if (existingCount >= expectedDays) {
    return;
  }

  const latitude = "51.8426";
  const longitude = "5.8518";

  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${latitude}` +
    `&longitude=${longitude}` +
    `&start_date=${fetchStart}` +
    `&end_date=${fetchEnd}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&timezone=Europe/Amsterdam`;

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Weer-API fout: ${res.status}`);
  }

  const json = (await res.json()) as WeerApiResponse;
  const daily = json.daily;

  if (!daily?.time?.length) {
    throw new Error("Weer-API gaf geen dagdata terug");
  }

  const dates = daily.time;
  const codes = daily.weather_code ?? [];
  const mins = daily.temperature_2m_min ?? [];
  const maxs = daily.temperature_2m_max ?? [];
  const precs = daily.precipitation_sum ?? [];

  for (let i = 0; i < dates.length; i++) {
    const datum = dates[i];
    const weatherCode = codes[i] == null ? null : Number(codes[i]);
    const tempMin = mins[i] == null ? null : Number(mins[i]);
    const tempMax = maxs[i] == null ? null : Number(maxs[i]);
    const neerslagMm = precs[i] == null ? null : Number(precs[i]);

    await dbRapportage.query(
      `
      INSERT INTO rapportage.weer_per_dag (
        datum,
        bron,
        omschrijving,
        weather_code,
        temp_min,
        temp_max,
        neerslag_mm,
        bijgewerkt_op
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        now()
      )
      ON CONFLICT (datum)
      DO UPDATE SET
        bron = EXCLUDED.bron,
        omschrijving = EXCLUDED.omschrijving,
        weather_code = EXCLUDED.weather_code,
        temp_min = EXCLUDED.temp_min,
        temp_max = EXCLUDED.temp_max,
        neerslag_mm = EXCLUDED.neerslag_mm,
        bijgewerkt_op = now()
      `,
      [
        datum,
        "open-meteo-archive",
        getWeatherDescription(weatherCode),
        weatherCode,
        tempMin,
        tempMax,
        neerslagMm,
      ]
    );
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  const now = new Date();

  const jaarParam = url.searchParams.get("jaar");
  const startRaw = url.searchParams.get("start") ?? url.searchParams.get("van");
  const endRaw = url.searchParams.get("end") ?? url.searchParams.get("tot");

  let start: string;
  let end: string;

  try {
    if (jaarParam) {
      const y = Number(jaarParam);
      if (!Number.isInteger(y) || y < 2000 || y > 2100) {
        return NextResponse.json({ error: "Ongeldig jaar" }, { status: 400 });
      }
      [start, end] = yearRange(y);
    } else if (startRaw && endRaw) {
      start = toISO(startRaw);
      end = toISO(endRaw);

      if (!isISO(start) || !isISO(end)) {
        return NextResponse.json(
          { error: "Datums moeten YYYY-MM-DD of DD-MM-YYYY zijn" },
          { status: 400 }
        );
      }
    } else {
      [start, end] = yearRange(now.getFullYear());
    }

    await ensureWeerRange(start, end);

    const { rows } = await dbRapportage.query(
      `
      WITH f AS (
        SELECT datum::date AS datum, naam
        FROM rapportage.feestdagen
        WHERE datum BETWEEN $1 AND $2
      ),
      mv_dag AS (
        SELECT datum, SUM(omzet) AS omzet, SUM(aantal) AS aantal
        FROM rapportage.omzet_dag_product
        WHERE datum BETWEEN $1 AND $2
        GROUP BY datum
      ),
      raw_dag AS (
        SELECT
          datum::date AS datum,
          SUM(aantal * eenheidsprijs) AS omzet,
          SUM(aantal) AS aantal
        FROM rapportage.omzet
        WHERE datum BETWEEN $1 AND $2
        GROUP BY datum
      ),
      dagomzet AS (
        SELECT
          COALESCE(m.datum, r.datum) AS datum,
          COALESCE(m.omzet, r.omzet) AS omzet,
          COALESCE(m.aantal, r.aantal) AS aantal
        FROM raw_dag r
        FULL JOIN mv_dag m ON m.datum = r.datum
      )
      SELECT
        f.datum::date AS datum,
        TO_CHAR(f.datum, 'YYYY-MM-DD') AS dag,
        f.naam AS naam,
        f.naam AS feestdag,
        COALESCE(d.omzet, 0)::numeric AS omzet,
        COALESCE(d.aantal, 0)::int AS aantal,
        w.bron,
        w.omschrijving AS weer_omschrijving,
        w.weather_code,
        w.temp_min,
        w.temp_max,
        w.neerslag_mm
      FROM f
      LEFT JOIN dagomzet d
        ON d.datum = f.datum
      LEFT JOIN rapportage.weer_per_dag w
        ON w.datum = f.datum
      ORDER BY f.datum, f.naam
      `,
      [start, end]
    );

    if (debug) {
      const [{ count: fdays } = { count: "0" }] = (
        await dbRapportage.query(
          `
          SELECT COUNT(*)::int AS count
          FROM rapportage.feestdagen
          WHERE datum BETWEEN $1 AND $2
          `,
          [start, end]
        )
      ).rows as any[];

      const [{ count: wdays } = { count: "0" }] = (
        await dbRapportage.query(
          `
          SELECT COUNT(*)::int AS count
          FROM rapportage.weer_per_dag
          WHERE datum BETWEEN $1 AND $2
          `,
          [start, end]
        )
      ).rows as any[];

      return NextResponse.json(
        {
          start,
          end,
          feestdagen_in_bereik: Number(fdays),
          weerdagen_in_bereik: Number(wdays),
          data: rows,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(rows, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    console.error("[feestdagomzet] error:", e?.message ?? e);
    return NextResponse.json(
      { error: "Serverfout in feestdagomzet", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}