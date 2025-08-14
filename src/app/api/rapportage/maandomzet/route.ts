// src/app/api/rapportage/maandomzet/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { startTimer } from "@/lib/timing";
import { dbRapportage } from "@/lib/dbRapportage";
import { NextResponse } from "next/server";

export async function GET() {
  const tAll = startTimer("/api/rapportage/maandomzet");
  try {
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
        FROM rapportage.omzet
      )
      SELECT mv.jaar, mv.maand_start, mv.totaal, last.max_datum
      FROM mv
      CROSS JOIN last
    `);
    t1.end();

    // max_datum zit nu op elke rij; pak de eerste (of null)
    const payload = {
      rows: rows.map(r => ({
        jaar: Number(r.jaar),
        maand_start: String(r.maand_start),
        totaal: Number(r.totaal),
      })),
      max_datum: rows[0]?.max_datum ?? null,
    };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (err) {
    console.error("API maandomzet fout:", err);
    return NextResponse.json({ rows: [], max_datum: null }, { status: 200 });
  } finally {
    tAll.end({ hint: "maandomzet" });
  }
}
