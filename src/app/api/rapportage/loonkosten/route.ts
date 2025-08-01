import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const result = await pool.query(`
    SELECT jaar, maand, lonen, loonheffing, pensioenpremie
    FROM rapportage.loonkosten
    ORDER BY jaar, maand;
  `);
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const { jaar, maand, lonen = 0, loonheffing = 0, pensioenpremie = 0 } = await req.json();

  if (!jaar || !maand) {
    return NextResponse.json({ error: "Jaar en maand verplicht" }, { status: 400 });
  }

  await pool.query(`
    INSERT INTO rapportage.loonkosten (jaar, maand, lonen, loonheffing, pensioenpremie)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (jaar, maand) DO UPDATE SET
      lonen = EXCLUDED.lonen,
      loonheffing = EXCLUDED.loonheffing,
      pensioenpremie = EXCLUDED.pensioenpremie;
  `, [jaar, maand, lonen, loonheffing, pensioenpremie]);

  return NextResponse.json({ success: true });
}
