// ================================
// File: src/app/api/rapportage/maandomzet/route.ts
// ================================
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

type MaandRecord = {
  maand: number;       // 1..12
  omzet: number;       // som(aantal*eenheidsprijs)
  dagen: number;       // aantal unieke dagen met omzet in die maand
};

export async function GET(req: NextRequest) {
  try {
    // Jaar uit querystring of default = huidig jaar
    const jaar =
      parseInt(req.nextUrl.searchParams.get("jaar") || "", 10) ||
      new Date().getFullYear();

    // We berekenen maandcijfers direct uit rapportage.omzet
    // en zorgen met generate_series(1,12) dat alle maanden aanwezig zijn.
    const { rows } = await pool.query<MaandRecord>(
      `
      WITH maanden AS (
        SELECT gs::int AS maand
        FROM generate_series(1, 12) AS gs
      ),
      omzet_per_maand AS (
        SELECT
          EXTRACT(MONTH FROM o.datum)::int AS maand,
          SUM(o.aantal * o.eenheidsprijs)::numeric(18,2) AS omzet,
          COUNT(DISTINCT date_trunc('day', o.datum))::int AS dagen
        FROM rapportage.omzet o
        WHERE EXTRACT(YEAR FROM o.datum)::int = $1
        GROUP BY 1
      )
      SELECT
        m.maand,
        COALESCE(opm.omzet, 0)::float8 AS omzet,
        COALESCE(opm.dagen, 0)        AS dagen
      FROM maanden m
      LEFT JOIN omzet_per_maand opm USING (maand)
      ORDER BY m.maand;
      `,
      [jaar]
    );

    // Zorg voor consistente shape
    const maanden = rows.map((r) => ({
      maand: r.maand,
      omzet: Number(r.omzet) || 0,
      dagen: Number(r.dagen) || 0,
    }));

    return NextResponse.json({ jaar, maanden });
  } catch (err) {
    console.error("[/api/rapportage/maandomzet] error:", err);
    return NextResponse.json(
      { error: "Serverfout", details: (err as Error).message },
      { status: 500 }
    );
  }
}
