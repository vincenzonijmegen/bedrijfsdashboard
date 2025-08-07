/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }) {
  const { startbedrag, datum } = await req.json();
  const id = params.id;

  const d = new Date(datum);
  const isEersteJanuari = d.getDate() === 1 && d.getMonth() === 0;

  if (!isEersteJanuari) {
    return NextResponse.json({ error: 'Alleen op 1 januari mag het startbedrag worden gewijzigd.' }, { status: 403 });
  }

  await db.query(
    `UPDATE kasboek_dagen SET startbedrag = $1 WHERE id = $2`,
    [startbedrag, id]
  );

  // trigger herberekening vanaf deze datum
  await db.query(
    `SELECT pg_notify('herbereken_kasboek', $1)`,
    [datum]
  );

  return NextResponse.json({ status: 'ok' });
}
