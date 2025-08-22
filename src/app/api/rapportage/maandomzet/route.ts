// src/app/api/rapportage/maandomzet/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { startTimer } from "@/lib/timing";
import { dbRapportage } from "@/lib/dbRapportage";
import { NextResponse, NextRequest } from "next/server";

type Row = { jaar: number; maand_start: string; totaal: number };
type Payload = { rows: Row[]; max_datum: string | null };

// 🔒 Cache in memory per serverless-instance
declare global {
  // eslint-disable-next-line no-var
  var __maandomzet_cache:
    | { ts: number; payload: Payload }
    | undefined;
}
const TTL_MS = 60_000; // 60s; kun je naar 300_000 (5 min) zetten als je wilt

export async function GET(req: NextRequest) {
  const tAll = startTimer("/api/rapportage/maandomzet");

  // Handmatige refresh trigger: /api/rapportage/maandomzet?refresh=1
  const force = req.nextUrl.searchParams.get("refresh") === "1";

  // 1) Serve from cache als vers en niet geforceerd
  if (!force && global.__maandomzet_cache) {
    const age = Date.now() - global.__maandomzet_cache.ts;
    if (age < TTL_MS) {
      return NextResponse.json(global.__maandomzet_cache.payload, {
        headers: { "Cache-Control": `private, max-age=${Math.floor((TTL_MS - age)/1000)}` },
      });
    }
  }

  try {
    // 2) Één DB-roundtrip (MV + max_datum)
    const t1 = startTimer("maandomzet:singlecall");
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
        FROM rapportage.omzet_maand
      )
      SELECT mv.jaar, mv.maand_start, mv.totaal, last.max_datum
      FROM mv
      CROSS JOIN last
    `);
    t1.end();

    const payload: Payload = {
      rows: rows.map(r => ({
        jaar: Number(r.jaar),
        maand_start: String(r.maand_start),
        totaal: Number(r.totaal),
      })),
      max_datum: rows[0]?.max_datum ?? null,
    };

    // 3) Cache setten
    global.__maandomzet_cache = { ts: Date.now(), payload };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (err) {
    console.error("API maandomzet fout:", err);
    const empty: Payload = { rows: [], max_datum: null };
    // voorkom UI-crash; cache niet bij fout
    return NextResponse.json(empty, { status: 200 });
  } finally {
    tAll.end({ hint: "maandomzet" });
  }
}
