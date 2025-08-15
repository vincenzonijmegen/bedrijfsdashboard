// src/app/api/rapportage/loonkosten/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Row = {
  jaar: number;
  maand: number; // 3..9
  lonen: number;
  loonheffing: number;
  pensioenpremie: number;
};

// ---- GET: altijd maanden 3..9 voor gekozen jaar (default huidig) ----
export async function GET(req: Request) {
  const url = new URL(req.url);
  const now = new Date();
  const jaar = Number(url.searchParams.get("jaar") ?? now.getFullYear());

  try {
    // Robuuste bron: ondersteunt tabellen met (jaar,maand,...) of met (datum,...)
    const q = `
      WITH maanden AS (
        SELECT m AS maand FROM (VALUES (3),(4),(5),(6),(7),(8),(9)) v(m)
      ),
      bron AS (
        SELECT
          COALESCE(jaar, EXTRACT(YEAR FROM datum)::int)  AS jaar,
          COALESCE(maand, EXTRACT(MONTH FROM datum)::int) AS maand,
          COALESCE(lonen::numeric,0)                     AS lonen,
          COALESCE(loonheffing::numeric,0)               AS loonheffing,
          COALESCE(pensioenpremie::numeric,0)            AS pensioenpremie
        FROM rapportage.loonkosten
      ),
      agg AS (
        SELECT jaar, maand,
               SUM(lonen)            AS lonen,
               SUM(loonheffing)      AS loonheffing,
               SUM(pensioenpremie)   AS pensioenpremie
        FROM bron
        WHERE jaar = $1 AND maand BETWEEN 3 AND 9
        GROUP BY 1,2
      )
      SELECT
        $1::int AS jaar,
        m.maand,
        COALESCE(a.lonen,0)          AS lonen,
        COALESCE(a.loonheffing,0)    AS loonheffing,
        COALESCE(a.pensioenpremie,0) AS pensioenpremie
      FROM maanden m
      LEFT JOIN agg a ON a.maand = m.maand
      ORDER BY m.maand;
    `;
    const res = await db.query(q, [jaar]);
    const data: Row[] = (res.rows ?? []).map((r: any) => ({
      jaar,
      maand: Number(r.maand),
      lonen: Number(r.lonen) || 0,
      loonheffing: Number(r.loonheffing) || 0,
      pensioenpremie: Number(r.pensioenpremie) || 0,
    }));
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    // Val veilig terug op 7 lege maanden zodat UI nooit crasht
    const fallback: Row[] = [3,4,5,6,7,8,9].map((m) => ({
      jaar, maand: m, lonen: 0, loonheffing: 0, pensioenpremie: 0,
    }));
    return NextResponse.json(fallback, { headers: { "Cache-Control": "no-store" } });
  }
}

// ---- POST: upsert meerdere velden in één keer ----
// Body: { jaar, maand, lonen?, loonheffing?, pensioenpremie? }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const jaar = Number(body.jaar);
    const maand = Number(body.maand);
    const lonen = body.lonen !== undefined ? Number(body.lonen) : null;
    const loonheffing = body.loonheffing !== undefined ? Number(body.loonheffing) : null;
    const pensioenpremie = body.pensioenpremie !== undefined ? Number(body.pensioenpremie) : null;

    if (!jaar || !maand) {
      return NextResponse.json({ error: "jaar en maand zijn verplicht" }, { status: 400 });
    }

    // Upsert zonder ON CONFLICT-vereiste (werkt ook zonder unieke index):
    const q = `
      WITH upsert AS (
        UPDATE rapportage.loonkosten
        SET
          lonen = COALESCE($3, lonen),
          loonheffing = COALESCE($4, loonheffing),
          pensioenpremie = COALESCE($5, pensioenpremie)
        WHERE jaar = $1 AND maand = $2
        RETURNING jaar, maand, lonen, loonheffing, pensioenpremie
      )
      INSERT INTO rapportage.loonkosten (jaar, maand, lonen, loonheffing, pensioenpremie)
      SELECT $1, $2,
             COALESCE($3,0), COALESCE($4,0), COALESCE($5,0)
      WHERE NOT EXISTS (SELECT 1 FROM upsert)
      RETURNING jaar, maand, lonen, loonheffing, pensioenpremie;
    `;
    const r = await db.query(q, [jaar, maand, lonen, loonheffing, pensioenpremie]);

    // Als UPDATE deed het werk, zit er niets in RETURNING; haal het dan via SELECT op
    let row = r.rows?.[0];
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
      row = get.rows?.[0];
    }

    return NextResponse.json({
      jaar: Number(row.jaar),
      maand: Number(row.maand),
      lonen: Number(row.lonen) || 0,
      loonheffing: Number(row.loonheffing) || 0,
      pensioenpremie: Number(row.pensioenpremie) || 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Opslaan mislukt" }, { status: 500 });
  }
}

// ---- PATCH: upsert één veld ----
// Body: { jaar, maand, veld, waarde }  // veld ∈ ['lonen','loonheffing','pensioenpremie']
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const jaar = Number(body.jaar);
    const maand = Number(body.maand);
    const veld = String(body.veld || "");
    const waarde = Number(body.waarde);

    if (!jaar || !maand || !["lonen","loonheffing","pensioenpremie"].includes(veld)) {
      return NextResponse.json({ error: "jaar/maand/veld ongeldig" }, { status: 400 });
    }

    // Dynamisch veld updaten (SQL injection-safe via vaste keus hierboven)
    const kolom = veld === "lonen" ? "lonen"
                : veld === "loonheffing" ? "loonheffing"
                : "pensioenpremie";

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
      jaar: Number(row.jaar),
      maand: Number(row.maand),
      lonen: Number(row.lonen) || 0,
      loonheffing: Number(row.loonheffing) || 0,
      pensioenpremie: Number(row.pensioenpremie) || 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Opslaan mislukt" }, { status: 500 });
  }
}
