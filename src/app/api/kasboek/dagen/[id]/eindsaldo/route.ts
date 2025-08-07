/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function PATCH(req, { params }) {
  const { eindsaldo } = await req.json();
  const res = await db.query(
    'UPDATE kasboek_dagen SET eindsaldo = $1 WHERE id = $2 RETURNING *',
    [eindsaldo, params.id]
  );
  return NextResponse.json(res.rows[0]);
}
