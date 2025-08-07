// @ts-nocheck
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const datum = req.nextUrl.searchParams.get('datum');

  const { rows } = await db.query(
    `SELECT eindsaldo FROM kasboek_dagen WHERE datum < $1 ORDER BY datum DESC LIMIT 1`,
    [datum]
  );

  if (rows.length === 0) {
    return NextResponse.json({ eindsaldo: null });
  }

  return NextResponse.json({ eindsaldo: rows[0].eindsaldo });
}
