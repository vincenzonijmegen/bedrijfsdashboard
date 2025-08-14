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
        SELECT jaar, maand_start, totaal
        FROM rapportage.omzet_maand
        ORDER BY maand_start
      ),
      last AS (
        SELECT MAX(datum) AS max_datum
        FROM rapportage.omzet
      )
      SELECT 
        (SELECT json_agg(mv) FROM mv)            AS rows,
        (SELECT max_datum FROM last)             AS max_datum
    `);
    t1.end();

    const payload = {
      rows: rows[0]?.rows ?? [],
      max_datum: rows[0]?.max_datum ?? null,
    };

    return new NextResponse(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    console.error("API maandomzet fout:", err);
    return NextResponse.json({ error: "Fout bij ophalen maandomzet" }, { status: 500 });
  } finally {
    tAll.end({ hint: "maandomzet" });
  }
}
