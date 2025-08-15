// src/app/api/rapportage/loonkosten/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type LoonkostenItem = {
  jaar: number;
  maand: number; // 3..9
  lonen: number;
  loonheffing: number;
  pensioenpremie: number;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const now = new Date();
  const jaar = Number(url.searchParams.get("jaar") ?? now.getFullYear());

  try {
    // ✅ Belangrijk: filter op COALESCE(jaar, EXTRACT(YEAR FROM datum))
    const q = `
      WITH maanden AS (
        SELECT m AS maand FROM (VALUES (3),(4),(5),(6),(7),(8),(9)) AS v(m)
      ),
      agg AS (
        SELECT
          COALESCE(maand, EXTRACT(MONTH FROM datum)::int)         AS maand,
          SUM(COALESCE(lonen, 0))                                 AS lonen,
          SUM(COALESCE(loonheffing, 0))                           AS loonheffing,
          SUM(COALESCE(pensioenpremie, 0))                        AS pensioenpremie
        FROM rapportage.loonkosten
        WHERE COALESCE(jaar, EXTRACT(YEAR FROM datum)::int) = $1
        GROUP BY 1
      )
      SELECT
        $1::int                          AS jaar,
        m.maand                          AS maand,
        COALESCE(a.lonen, 0)             AS lonen,
        COALESCE(a.loonheffing, 0)       AS loonheffing,
        COALESCE(a.pensioenpremie, 0)    AS pensioenpremie
      FROM maanden m
      LEFT JOIN agg a ON a.maand = m.maand
      ORDER BY m.maand;
    `;

    const r = await db.query(q, [jaar]);
    const data: LoonkostenItem[] = (r.rows ?? []).map((x: any) => ({
      jaar: Number(x.jaar),
      maand: Number(x.maand),
      lonen: Number(x.lonen),
      loonheffing: Number(x.loonheffing),
      pensioenpremie: Number(x.pensioenpremie),
    }));

    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Fallback: altijd 3..9 met nullen, zodat UI niet crasht
    const fallback: LoonkostenItem[] = [3,4,5,6,7,8,9].map((m) => ({
      jaar, maand: m, lonen: 0, loonheffing: 0, pensioenpremie: 0,
    }));
    return NextResponse.json(fallback, { headers: { "Cache-Control": "no-store" } });
  }
}
