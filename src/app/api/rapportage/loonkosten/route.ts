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

function toNum(n: any, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

/* -------------------------------- GET ---------------------------------- */
/** Lezen: altijd 12 maanden voor gekozen jaar (default = huidig). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const now = new Date();
  const jaar = toNum(url.searchParams.get("jaar"), now.getFullYear());

  try {
    // Ondersteunt zowel tabellen met (jaar, maand, ...) als met (datum, ...)
    const q = `
      WITH maanden AS (
        SELECT generate_series(1,12) AS maand
      ),
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
               SUM(lonen)           AS lonen,
               SUM(loonheffing)     AS loonheffing,
               SUM(pensioenpremie)  AS pensioenpremie
        FROM bron
        WHERE jaar = $1
        GROUP BY 1,2
      )
      SELECT
        $1::int AS jaar,
        m.maand,
        COALESCE(a.lonen,0)           AS lonen,
        COALESCE(a.loonheffing,0)     AS loonheffing,
        COALESCE(a.pensioenpremie,0)  AS pensioenpremie
      FROM maanden m
      LEFT JOIN agg a ON a.maand = m.maand
      ORDER BY m.maand;
    `;
    const res = await db.query(q, [jaar]);

    const maanden: Row[] = (res.rows ?? []).map((r: any) => ({
      maand: toNum(r.maand),
      lonen: toNum(r.lonen),
      loonheffing: toNum(r.loonheffing),
      pensioenpremie: toNum(r.pensioenpremie),
    }));

    const body: ApiResponse = { jaar, maanden };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    // Val veilig terug op 12 lege maanden zodat de UI nooit crasht
    const maanden: Row[] = Array.from({ length: 12 }, (_, i) => ({
      maand: i + 1, lonen: 0, loonheffing: 0, pensioenpremie: 0,
    }));
    return NextResponse.json({ jaar, maanden } satisfies ApiResponse, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}

/* ------------------------------- POST ---------------------------------- */
/** Upsert van één maand; body: { jaar, maand, lonen?, loonheffing?, pensioenpremie? } */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const jaar = toNum(b.jaar);
    const maand = toNum(b.maand);
    const lonen = b.lonen === undefined ? null : toNum(b.lonen);
    const loonheffing = b.loonheffing === undefined ? null : toNum(b.loonheffing);
    const pensioenpremie = b.pensioenpremie === undefined ? null : toNum(b.pensioenpremie);

    if (!jaar || !maand) {
      return NextResponse.json({ error: "jaar en maand zijn verplicht" }, { status: 400 });
    }

    // Upsert zonder unieke index: UPDATE, en zo niet, INSERT.
    const q = `
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
      RETURNING jaar, maand, lonen, loonheffing, pensioenpremie;
    `;
    let r = await db.query(q, [jaar, maand, lonen, loonheffing, pensioenpremie]);
    if (!r.rows?.[0]) {
      r = await db.query(
        `SELECT jaar, maand,
                COALESCE(lonen,0) AS lonen,
                COALESCE(loonheffing,0) AS loonheffing,
                COALESCE(pensioenpremie,0) AS pensioenpremie
           FROM rapportage.loonkosten
          WHERE jaar=$1 AND maand=$2`,
        [jaar, maand]
      );
    }
    const row = r.rows[0];
    return NextResponse.json({
      jaar: toNum(row.jaar),
      maand: toNum(row.maand),
      lonen: toNum(row.lonen),
      loonheffing: toNum(row.loonheffing),
      pensioenpremie: toNum(row.pensioenpremie),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Opslaan mislukt" }, { status: 500 });
  }
}

/* ------------------------------- PATCH --------------------------------- */
/** Eén veld bijwerken; body: { jaar, maand, veld, waarde }, veld ∈ ['lonen','loonheffing','pensioenpremie'] */
export async function PATCH(req: Request) {
  try {
    const b = await req.json();
    const jaar = toNum(b.jaar);
    const maand = toNum(b.maand);
    const veld = String(b.veld || "");
    const waarde = toNum(b.waarde);

    if (!jaar || !maand || !["lonen","loonheffing","pensioenpremie"].includes(veld)) {
      return NextResponse.json({ error: "jaar/maand/veld ongeldig" }, { status: 400 });
    }

    const kolom =
      veld === "lonen" ? "lonen" :
      veld === "loonheffing" ? "loonheffing" : "pensioenpremie";

    const q = `
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
    const r = await db.query(q, [jaar, maand, waarde]);
    const row = r.rows?.[0];
    return NextResponse.json({
      jaar: toNum(row.jaar),
      maand: toNum(row.maand),
      lonen: toNum(row.lonen),
      loonheffing: toNum(row.loonheffing),
      pensioenpremie: toNum(row.pensioenpremie),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Opslaan mislukt" }, { status: 500 });
  }
}

/* --------------------------- HEAD / OPTIONS ---------------------------- */
export function HEAD() {
  return new Response(null, { status: 200, headers: { Allow: "GET,POST,PATCH,OPTIONS,HEAD" } });
}
export function OPTIONS() {
  return new Response(null, { status: 200, headers: { Allow: "GET,POST,PATCH,OPTIONS,HEAD" } });
}
