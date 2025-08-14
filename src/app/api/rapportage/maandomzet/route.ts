// src/app/api/rapportage/maandomzet/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { startTimer } from "@/lib/timing";
import { dbRapportage } from "@/lib/dbRapportage";
import { NextResponse, NextRequest } from "next/server";

type Row = { jaar: number; maand_start: string; totaal: number };
type Payload = { rows: Row[]; max_datum: string | null };

function maskConnStr(cs?: string) {
  if (!cs) return "";
  // mask: postgres://user:****@host:port/db
  try {
    const u = new URL(cs);
    const user = u.username || "";
    const host = u.hostname || "";
    const db = u.pathname?.slice(1) || "";
    const port = u.port || "";
    return `postgres://${user ? user : "?"}:****@${host}${port ? ":" + port : ""}/${db}`;
  } catch {
    return "unparseable-connection-string";
  }
}

export async function GET(req: NextRequest) {
  const tAll = startTimer("/api/rapportage/maandomzet");
  const debug = req.nextUrl.searchParams.get("debug") === "1";

  try {
    // Snel pad via MV in 1 roundtrip
    const t1 = startTimer("maandomzet:singlecall:mv");
    const { rows } = await dbRapportage.query(`
      WITH mv AS (
        SELECT 
          jaar,
          to_char(maand_start, 'YYYY-MM-01') AS maand_start,
          totaal
        FROM rapportage.omzet_maand
        ORDER BY maand_start
      ),
      last AS (
        SELECT MAX(datum) AS max_datum
        FROM rapportage.omzet
      )
      SELECT 
        COALESCE( (SELECT json_agg(mv) FROM mv), '[]'::json ) AS rows,
        (SELECT max_datum FROM last)                         AS max_datum
    `);
    t1.end();

    const payload: Payload = {
      rows: (rows[0]?.rows as Row[]) ?? [],
      max_datum: (rows[0]?.max_datum as string) ?? null,
    };

    if (debug) {
      // extra: laat zien naar welke DB we praten en hoeveel rijen MV/bron hebben
      const meta = await dbRapportage.query(`
        SELECT current_database() AS db,
               current_user AS usr,
               to_regclass('rapportage.omzet_maand') IS NOT NULL AS mv_exists,
               (SELECT COUNT(*)::int FROM rapportage.omzet_maand) AS mv_count,
               (SELECT COUNT(*)::int FROM rapportage.omzet) AS raw_count
      `);
      const conn = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
      return NextResponse.json({
        ...payload,
        __debug: {
          envPicked: process.env.POSTGRES_URL ? "POSTGRES_URL" : "DATABASE_URL",
          connMasked: maskConnStr(conn),
          meta: meta.rows[0],
        },
      });
    }

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=60" },
    });

  } catch (mvErr) {
    // Fallback: altijd werkend maar traag
    try {
      const agg = await dbRapportage.query(`
        WITH per_maand AS (
          SELECT DATE_TRUNC('month', datum) AS maand_start,
                 SUM(aantal * eenheidsprijs) AS som
          FROM rapportage.omzet
          GROUP BY 1
        )
        SELECT 
          EXTRACT(YEAR FROM maand_start)::int AS jaar,
          to_char(maand_start, 'YYYY-MM-01')  AS maand_start,
          ROUND(som)::bigint                  AS totaal
        FROM per_maand
        ORDER BY maand_start
      `);
      const maxDatum = await dbRapportage.query(`SELECT MAX(datum) AS max_datum FROM rapportage.omzet`);
      const payload: Payload = { rows: agg.rows as Row[], max_datum: (maxDatum.rows[0]?.max_datum as string) ?? null };
      return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=30" } });
    } catch (aggErr) {
      const payload: Payload = { rows: [], max_datum: null };
      return NextResponse.json(payload, { status: 200 });
    }
  } finally {
    tAll.end({ hint: "maandomzet" });
  }
}
