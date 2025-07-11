import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const result = await db.query('SELECT * FROM kleuren ORDER BY naam');
  return NextResponse.json(result.rows);
}
