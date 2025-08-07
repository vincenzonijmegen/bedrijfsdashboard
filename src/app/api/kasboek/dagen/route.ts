/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { parseISO } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const maand = req.nextUrl.searchParams.get('maand');
  const values = maand ? [maand] : [];
  const query = maand
    ? `
      SELECT d.*, COUNT(t.id) AS aantal_transacties
      FROM kasboek_dagen d
      LEFT JOIN kasboek_transacties t ON d.id = t.dag_id
      WHERE TO_CHAR(d.datum, 'YYYY-MM') = $1
      GROUP BY d.id
      ORDER BY d.datum
    `
    : `
      SELECT d.*, COUNT(t.id) AS aantal_transacties
      FROM kasboek_dagen d
      LEFT JOIN kasboek_transacties t ON d.id = t.dag_id
      GROUP BY d.id
      ORDER BY d.datum
    `;

  const res = await db.query(query, values);
  return NextResponse.json(res.rows);
}
