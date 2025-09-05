import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
export const runtime = 'nodejs';

// Bepaalt ISO-jaar/week in Europe/Amsterdam, en maakt '2025W36'
const PERIOD_SQL = `to_char((now() at time zone 'Europe/Amsterdam')::date, 'IYYY"W"IW')`;

export async function POST(req: NextRequest) {
  const { id, action } = await req.json(); // action: 'done' | 'undone'
  if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 });

  try {
    if (action === 'undone') {
      const { rows } = await pool.query(
        `UPDATE acties
           SET last_done_period = NULL,
               updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [id]
      );
      return NextResponse.json(rows[0]);
    }

    // default: done
    const { rows } = await pool.query(
      `UPDATE acties
         SET last_done_period = ${PERIOD_SQL},
             updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return NextResponse.json(rows[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
