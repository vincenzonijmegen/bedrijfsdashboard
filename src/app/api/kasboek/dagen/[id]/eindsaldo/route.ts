import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  const { eindsaldo } = await req.json();
  const id = context.params.id;

  const res = await db.query(
    `UPDATE kasboek_dagen SET eindsaldo = $1 WHERE id = $2 RETURNING *`,
    [eindsaldo, id]
  );
  return NextResponse.json(res.rows[0]);
}
