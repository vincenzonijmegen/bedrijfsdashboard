import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const result = await db.query('SELECT * FROM ijs_productie ORDER BY datum DESC, id DESC');
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const { smaak, datum, aantal, kleur } = await req.json();

  if (!smaak || !datum || !aantal || !kleur) {
    return NextResponse.json({ error: 'Alle velden zijn verplicht' }, { status: 400 });
  }

  const result = await db.query(
    `INSERT INTO ijs_productie (smaak, datum, aantal, kleur)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [smaak, datum, aantal, kleur]
  );

  return NextResponse.json(result.rows[0]);
}
