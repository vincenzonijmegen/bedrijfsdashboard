// ================================
// File: src/app/api/rapportage/maandomzet/route.ts
// ================================
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Aggregatie: per kalendermaand (month start) en per jaar, over alle jaren in de tabel
    const { rows } = await pool.query<{
      jaar: number;
      maand_start: string; // date
      totaal: string;      // numeric
    }>(`
      WITH bron AS (
        SELECT
          EXTRACT(YEAR FROM datum)::int AS jaar,
          date_trunc('month', datum)::date AS maand_start,
          SUM(aantal * eenheidsprijs)::numeric(18,2) AS totaal
        FROM rapportage.omzet
        GROUP BY 1, 2
      )
      SELECT jaar, maand_start, totaal
      FROM bron
      ORDER BY maand_start, jaar;
    `);

    const maxRes = await pool.query<{ max_datum: string }>(
      `SELECT MAX(datum)::date AS max_datum FROM rapportage.omzet`
    );

    return NextResponse.json({
      rows: rows.map(r => ({
        jaar: Number(r.jaar),
        maand_start: r.maand_start,
        totaal: Number(r.totaal),
      })),
      max_datum: maxRes.rows[0]?.max_datum ?? null,
    });
  } catch (err) {
    console.error("[/api/rapportage/maandomzet] error:", err);
    return NextResponse.json(
      { error: "Serverfout", details: (err as Error).message },
      { status: 500 }
    );
  }
}
