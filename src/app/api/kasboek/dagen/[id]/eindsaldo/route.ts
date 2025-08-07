import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { eindsaldo } = await request.json();
  const res = await db.query(
    'UPDATE kasboek_dagen SET eindsaldo = $1 WHERE id = $2 RETURNING *',
    [eindsaldo, params.id]
  );
  return NextResponse.json(res.rows[0]);
}
