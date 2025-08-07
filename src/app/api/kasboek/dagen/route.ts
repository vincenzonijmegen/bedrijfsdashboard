import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const maand = req.nextUrl.searchParams.get('maand');
  const query = maand
    ? `SELECT * FROM kasboek_dagen WHERE TO_CHAR(datum, 'YYYY-MM') = $1 ORDER BY datum`
    : `SELECT * FROM kasboek_dagen ORDER BY datum`;
  const values = maand ? [maand] : [];
  const res = await db.query(query, values);
  return NextResponse.json(res.rows);
}

export async function POST(req: NextRequest) {
  const { datum, startbedrag } = await req.json();
  const res = await db.query(
    `INSERT INTO kasboek_dagen (datum, startbedrag) VALUES ($1, $2) RETURNING *`,
    [datum, startbedrag]
  );
  return NextResponse.json(res.rows[0]);
}
