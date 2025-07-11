// smaken/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const result = await db.query('SELECT * FROM smaken ORDER BY naam');
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const { naam } = await req.json();
  if (!naam) return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 });

  const result = await db.query(
    'INSERT INTO smaken (naam) VALUES ($1) RETURNING *',
    [naam]
  );
  return NextResponse.json(result.rows[0]);
}

