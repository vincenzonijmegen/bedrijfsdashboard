import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET: alle dagen per jaar/maand
export async function GET() {
  const rows = await db.query(
    'SELECT jaar, maand, dagen FROM rapportage.omzetdagen ORDER BY jaar DESC, maand'
  );
  return NextResponse.json(rows.rows);
}

// PATCH: update of insert dagen
export async function PATCH(req: NextRequest) {
  const { jaar, maand, dagen } = await req.json();
  if (!jaar || !maand || typeof dagen !== "number") {
    return NextResponse.json({ error: "Vul jaar, maand en dagen in" }, { status: 400 });
  }
  const result = await db.query(
    `INSERT INTO rapportage.omzetdagen (jaar, maand, dagen)
     VALUES ($1, $2, $3)
     ON CONFLICT (jaar, maand) DO UPDATE SET dagen = EXCLUDED.dagen
     RETURNING *`,
    [jaar, maand, dagen]
  );
  return NextResponse.json(result.rows[0]);
}
