// src/app/api/rapportage/loonkosten/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Row = {
  maand: number;              // 1..12
  lonen: number;
  loonheffing: number;
  pensioenpremie: number;
};

type ApiResponse = {
  jaar: number;
  maanden: Row[];
};

function num(n: any, fb = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fb;
}

/* ------------------------------- GET ---------------------------------- */
/** Lezen: altijd 12 maanden voor gekozen jaar (default = huidig). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const now = new Date();
  const jaar = num(url.searchParams.get("jaar"), now.getFullYear());

  try {
    // Lezen ondersteunt zowel schema met (jaar, maand, ...) als met (datum, ...)
    const q = `
      WITH m AS (SELECT generate_series(1,12) AS maand),
      bron AS (
        SELECT
          COALESCE(jaar, EXTRACT(YEAR  FROM datum)::int)  AS jaar,
          COALESCE(maand, EXTRACT(MONTH FROM datum)::int) AS maand,
          COALESCE(lonen::numeric,0)                      AS lonen,
          COALESCE(loonheffing::numeric,0)                AS loonheffing,
          COALESCE(pensioenpremie::numeric,0)             AS pensioenpremie
        FROM rapportage.loonkosten
      ),
      agg AS (
        SELECT jaar, maand,
               SUM(lonen)          AS lonen,
               SUM(loonheffing)    AS loonheffing,
               SUM(pensioenpremie) AS pensioenpremie
        FROM bron
        WHERE jaar = $1
        GROUP BY 1,2
      )
      SELECT $1::int AS jaar, m.maand,
             COALESCE(a.lonen,0)           AS lonen,
             COALESCE(a.loonheffing,0)     AS loonheffing,
             COALESCE(a.pensioenpremie,0)  AS pensioenpremie
      FROM m
      LEFT JOIN agg a ON a.maand = m.maand
      ORDER BY m.maand;
    `;
    const r = await db.query(q, [jaar]);
    const maanden: Row[] = (r.rows ?? []).map((x: any) => ({
      maand: num(x.maand),
      lonen: num(x.lonen),
      loonheffing: num(x.loonheffing),
      pensioenpremie: num(x.pensioenpremie),
    }));
    return NextResponse.json({ jaar, maanden } satisfies ApiResponse, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    const maanden: Row[] = Array.from({ length: 12 }, (_, i) => ({
      maand: i + 1, lonen: 0, loonheffing: 0, pensioenpremie: 0,
    }));
    return NextResponse.json({ jaar, maanden } satisfies ApiResponse, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}

/* ------------------------------- POST --------------------------------- */
/** Upsert van één maand; body: { jaar, maand, lonen?, loonheffing?, pensioenpremie? } */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const jaar = num(b.jaar);
    const maand = num(b.maand);
    const lonen = b.lonen === undefined ? null : num(b.lonen);
    const loonheffing = b.loonheffing === undefined ? null : num(b.loonheffing);
    const pensioenpremie = b.pensioenpremie === undefined ? null : num(b.pensioenpremie);

    if (!jaar || !maand) {
      return NextResponse.json({ error: "jaar en maand zijn verplicht" }, { status: 400 });
    }

    // Eerst proberen met ON CONFLICT (werkt als er een unieke index (jaar,maand) is)
    try {
      const q1 = `
        INSERT INTO rapportage.loonkosten (jaar, maand, lonen, loonheffing, pensioenpremie)
        VALUES ($1,$2, COALESCE($3,0), COALESCE($4,0), COALESCE($5,0))
        ON CONFLICT (jaar, maand)
        DO UPDATE SET
          lonen = COALESCE(EXCLUDED.lonen, rapportage.loonkosten.lonen),
          loonheffing = COALESCE(EXCLUDED.loonheffing, rapportage.loonkosten.loonheffing),
          pensioenpremie = COALESCE(EXCLUDED.pensioenpremie, rapportage.loonkosten.pensioenpremie)
        RETURNING jaar, maand, lonen, loonheffing, pensioenpremie;
      `;
      const r1 = await db.query(q1, [jaar, maand, lonen, loonheffing, pensioenpremie]);
      const row = r1.rows[0];
      return NextResponse.json({
        jaar: num(row.jaar),
        maand: num(row.maand),
        lonen: num(row.lonen),
        loonheffing: num(row.loonheffing),
        pensioenpremie: num(row.pensioenpremie),
      });
    } catch (e: any) {
      // Geen unieke index -> fallback via UPDATE then INSERT
      const q2 = `
        WITH upsert AS (
          UPDATE rapportage.loonkosten
             SET lonen = COALESCE($3, lonen),
                 loonheffing = COALESCE($4, loonheffing),
                 pensioenpremie = COALESCE($5, pensioenpremie)
           WHERE jaar = $1 AND maand = $2
          RETURNING jaar, maand, lonen, loonheffing, pensioenpremie
        )
        INSERT INTO rapportage.loonkosten (jaar, maand, lonen, loonheffing, pensioenpremie)
        SELECT $1, $2, COALESCE($3,0), COALESCE($4,0), COALESCE($5,0)
        WHERE NOT EXISTS (SELECT 1 FROM upsert)
        RETURNING jaar, maand, lonheffing, lonen, pensioenpremie;
      `;
      const r2 = await db.query(q2, [jaar, maand, lonen, loonheffing, pensioenpremie]);
      const row = r2.rows?.[0];
      if (!row) {
        const get = await db.query(
          `SELECT jaar, maand,
                  COALESCE(lonen,0) AS lonen,
                  COALESCE(loonheffing,0) AS loonheffing,
                  COALESCE(pensioenpremie,0) AS pensioenpremie
           FROM rapportage.loonkosten
           WHERE jaar=$1 AND maand=$2`,
          [jaar, maand]
        );
        return NextResponse.json(get.rows?.[0] ?? { jaar, maand, lonen: 0, loonheffing: 0, pensioenpremie: 0 });
      }
      return NextResponse.json({
        jaar: num(row.jaar),
        maand: num(row.maand),
        lonen: num(row.lonen),
        loonheffing: num(row.loonheffing),
        pensioenpremie: num(row.pensioenpremie),
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Opslaan mislukt" }, { status: 500 });
  }
}

/* ------------------------------- PATCH -------------------------------- */
/** Eén veld bijwerken; body: { jaar, maand, veld, waarde }, veld ∈ ['lonen','loonheffing','pensioenpremie'] */
export async function PATCH(req: Request) {
  try {
    const b = await req.json();
    const jaar = num(b.jaar);
    const maand = num(b.maand);
    const veld = String(b.veld || "");
    const waarde = num(b.waarde);

    if (!jaar || !maand || !["lonen","loonheffing","pensioenpremie"].includes(veld)) {
      return NextResponse.json({ error: "jaar/maand/veld ongeldig" }, { status: 400 });
    }
    const kolom =
      veld === "lonen" ? "lonen" :
      veld === "loonheffing" ? "loonheffing" : "pensioenpremie";

    // Ook hier eerst ON CONFLICT proberen
    try {
      const q1 = `
        INSERT INTO rapportage.loonkosten (jaar, maand, ${kolom})
        VALUES ($1,$2,$3)
        ON CONFLICT (jaar, maand)
        DO UPDATE SET ${kolom} = EXCLUDED.${kolom}
        RETURNING jaar, maand, lonen, loonheffing, pensioenpremie;
      `;
      const r1 = await db.query(q1, [jaar, maand, waarde]);
      const row = r1.rows[0];
      return NextResponse.json({
        jaar: num(row.jaar),
        maand: num(row.maand),
        lonen: num(row.lonen),
        loonheffing: num(row.loonheffing),
        pensioenpremie: num(row.pensioenpremie),
      });
    } catch {
      const q2 = `
        WITH upsert AS (
          UPDATE rapportage.loonkosten
             SET ${kolom} = $3
           WHERE jaar = $1 AND maand = $2
          RETURNING jaar, maand, lonen, loonheffing, pensioenpremie
        )
        INSERT INTO rapportage.loonkosten (jaar, maand, ${kolom})
        SELECT $1, $2, $3
        WHERE NOT EXISTS (SELECT 1 FROM upsert)
        RETURNING jaar, maand, lonen, loonheffing, pensioenpremie;
      `;
      const r2 = await db.query(q2, [jaar, maand, waarde]);
      const row = r2.rows?.[0];
      return NextResponse.json({
        jaar: num(row.jaar),
        maand: num(row.maand),
        lonen: num(row.lonen),
        loonheffing: num(row.loonheffing),
        pensioenpremie: num(row.pensioenpremie),
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Opslaan mislukt" }, { status: 500 });
  }
}

/* --------------------------- HEAD / OPTIONS --------------------------- */
export function HEAD() {
  return new Response(null, { status: 200, headers: { Allow: "GET,POST,PATCH,OPTIONS,HEAD" } });
}
export function OPTIONS() {
  return new Response(null, { status: 200, headers: { Allow: "GET,POST,PATCH,OPTIONS,HEAD" } });
}
