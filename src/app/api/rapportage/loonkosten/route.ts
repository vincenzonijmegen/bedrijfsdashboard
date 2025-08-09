import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
export const runtime = "nodejs";

// GET /api/rapportage/loonkosten?jaar=2025  -> { jaar, maanden: [...] }
// GET zonder ?jaar -> alle rijen (backwards compatible)
export async function GET(req: NextRequest) {
  const jaarParam = req.nextUrl.searchParams.get("jaar");
  const jaar = jaarParam ? parseInt(jaarParam, 10) : null;

  if (!jaar) {
    const result = await pool.query(`
      SELECT jaar, maand,
             COALESCE(lonen,0)          AS lonen,
             COALESCE(loonheffing,0)    AS loonheffing,
             COALESCE(pensioenpremie,0) AS pensioenpremie
      FROM rapportage.loonkosten
      ORDER BY jaar, maand;
    `);
    return NextResponse.json(result.rows);
  }

  const { rows } = await pool.query(
    `SELECT maand,
            COALESCE(lonen,0)          AS lonen,
            COALESCE(loonheffing,0)    AS loonheffing,
            COALESCE(pensioenpremie,0) AS pensioenpremie
     FROM rapportage.loonkosten
     WHERE jaar = $1
     ORDER BY maand`,
    [jaar]
  );

  // 12 maanden garanderen
  const map = new Map<number, any>();
  rows.forEach(r => map.set(Number(r.maand), {
    maand: Number(r.maand),
    lonen: Number(r.lonen ?? 0),
    loonheffing: Number(r.loonheffing ?? 0),
    pensioenpremie: Number(r.pensioenpremie ?? 0),
  }));

  const maanden = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return map.get(m) ?? { maand: m, lonen: 0, loonheffing: 0, pensioenpremie: 0 };
  });

  return NextResponse.json({ jaar, maanden });
}

// POST: upsert volledige rij (één maand)
export async function POST(req: Request) {
  const { jaar, maand, lonen = 0, loonheffing = 0, pensioenpremie = 0 } = await req.json();

  if (!jaar || !maand) {
    return NextResponse.json({ error: "Jaar en maand verplicht" }, { status: 400 });
  }

  await pool.query(
    `INSERT INTO rapportage.loonkosten (jaar, maand, lonen, loonheffing, pensioenpremie)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (jaar, maand)
     DO UPDATE SET
       lonen = EXCLUDED.lonen,
       loonheffing = EXCLUDED.loonheffing,
       pensioenpremie = EXCLUDED.pensioenpremie;`,
    [jaar, maand, lonen, loonheffing, pensioenpremie]
  );

  return NextResponse.json({ success: true });
}
