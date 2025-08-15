// src/app/api/rapportage/loonkosten/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Row = { jaar: number; maand: number; lonen: number; loonheffing: number; pensioenpremie: number };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const now = new Date();
  const jaar = Number(url.searchParams.get("jaar") ?? now.getFullYear());

  try {
    // 1) Probeer schema met losse kolommen JAAR/MAAND
    const qKolommen = `
      WITH maanden AS (SELECT m AS maand FROM (VALUES (3),(4),(5),(6),(7),(8),(9)) v(m)),
      agg AS (
        SELECT
          maand::int                                   AS maand,
          SUM(COALESCE(lonen::numeric,0))             AS lonen,
          SUM(COALESCE(loonheffing::numeric,0))       AS loonheffing,
          SUM(COALESCE(pensioenpremie::numeric,0))    AS pensioenpremie
        FROM rapportage.loonkosten
        WHERE jaar::int = $1
          AND maand::int BETWEEN 3 AND 9
        GROUP BY 1
      )
      SELECT $1::int AS jaar, m.maand,
             COALESCE(a.lonen,0)          AS lonen,
             COALESCE(a.loonheffing,0)    AS loonheffing,
             COALESCE(a.pensioenpremie,0) AS pensioenpremie
      FROM maanden m
      LEFT JOIN agg a ON a.maand = m.maand
      ORDER BY m.maand;
    `;

    let res = await db.query(qKolommen, [jaar]);

    // 2) Als alles 0 is, kan het zijn dat er geen kolommen jaar/maand bestaan maar wel DATUM
    const allesNul = !res.rows?.some((r: any) =>
      Number(r.lonen) || Number(r.loonheffing) || Number(r.pensioenpremie)
    );

    if (allesNul) {
      const qDatum = `
        WITH maanden AS (SELECT m AS maand FROM (VALUES (3),(4),(5),(6),(7),(8),(9)) v(m)),
        agg AS (
          SELECT
            EXTRACT(MONTH FROM datum)::int            AS maand,
            SUM(COALESCE(lonen::numeric,0))           AS lonen,
            SUM(COALESCE(loonheffing::numeric,0))     AS loonheffing,
            SUM(COALESCE(pensioenpremie::numeric,0))  AS pensioenpremie
          FROM rapportage.loonkosten
          WHERE EXTRACT(YEAR FROM datum)::int = $1
            AND EXTRACT(MONTH FROM datum)::int BETWEEN 3 AND 9
          GROUP BY 1
        )
        SELECT $1::int AS jaar, m.maand,
               COALESCE(a.lonen,0)          AS lonen,
               COALESCE(a.loonheffing,0)    AS loonheffing,
               COALESCE(a.pensioenpremie,0) AS pensioenpremie
        FROM maanden m
        LEFT JOIN agg a ON a.maand = m.maand
        ORDER BY m.maand;
      `;
      res = await db.query(qDatum, [jaar]);
    }

    const data: Row[] = (res.rows ?? []).map((r: any) => ({
      jaar,
      maand: Number(r.maand),
      lonen: Number(r.lonen) || 0,
      loonheffing: Number(r.loonheffing) || 0,
      pensioenpremie: Number(r.pensioenpremie) || 0,
    }));

    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    // Fallback: 3..9 met nullen, zodat de UI nooit crasht
    const fallback: Row[] = [3,4,5,6,7,8,9].map((m) => ({
      jaar, maand: m, lonen: 0, loonheffing: 0, pensioenpremie: 0,
    }));
    return NextResponse.json(fallback, { headers: { "Cache-Control": "no-store" } });
  }
}
