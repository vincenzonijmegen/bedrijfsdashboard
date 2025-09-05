import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
export const runtime = 'nodejs';

// Bepaalt ISO-jaar/week in Europe/Amsterdam, bv. '2025W36'
const PERIOD_SQL = `to_char((now() at time zone 'Europe/Amsterdam')::date, 'IYYY"W"IW')`;

export async function POST(req: NextRequest) {
  const { id, action } = await req.json();
  if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 });

  try {
    if (action === 'undone') {
      const { rows } = await db.query(
        `UPDATE acties
           SET last_done_period = NULL
         WHERE id = $1
         RETURNING *`,
        [id]
      );
      if (rows.length === 0) return NextResponse.json({ error: 'Actie niet gevonden' }, { status: 404 });
      return NextResponse.json(rows[0]);
    }

    // Default/explicit: 'done'
    const { rows } = await db.query(
      `UPDATE acties
         SET last_done_period = ${PERIOD_SQL}
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Actie niet gevonden' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err: any) {
    console.error('Fout in POST /api/acties/wekelijks:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
