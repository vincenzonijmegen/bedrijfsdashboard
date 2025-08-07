/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { parseISO } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { datum } = await req.json();

    if (!datum) {
      return NextResponse.json({ error: 'Datum ontbreekt' }, { status: 400 });
    }

    const parsedDate = parseISO(datum);

    const vorige = await db.query(
      `SELECT eindsaldo FROM kasboek_dagen WHERE datum < $1 ORDER BY datum DESC LIMIT 1`,
      [parsedDate]
    );

    const startbedrag = vorige.rows[0]?.eindsaldo ?? 0;

    const result = await db.query(
      `INSERT INTO kasboek_dagen (datum, startbedrag) VALUES ($1, $2) RETURNING *`,
      [datum, startbedrag]
    );

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('Fout in POST /kasboek/dagen:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
