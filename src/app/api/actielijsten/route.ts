// Bestand: src/app/api/actielijsten/route.ts
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const lijsten = await db.query('SELECT id, naam, icoon FROM actielijsten ORDER BY id');
    return NextResponse.json(lijsten.rows);
  } catch (err) {
    console.error("Fout bij ophalen actielijsten:", err);
    return NextResponse.json({ error: "Fout bij ophalen actielijsten" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { naam, icoon } = await req.json();

  if (!naam) {
    return NextResponse.json({ error: "Naam is verplicht" }, { status: 400 });
  }

  const result = await db.query(
    `INSERT INTO actielijsten (naam, icoon) VALUES ($1, $2) RETURNING *`,
    [naam, icoon || "📋"]
  );

  return NextResponse.json(result.rows[0]);
}
