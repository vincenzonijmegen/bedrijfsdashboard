// src/app/api/medewerkers/verzuim/[verzuimId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(_: NextRequest, { params }: { params: { verzuimId: string } }) {
  await db.query('DELETE FROM ziekteverzuim WHERE id = $1', [params.verzuimId]);
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { verzuimId: string } }) {
  const { van, tot, opmerking } = await req.json();
  await db.query(
    `UPDATE ziekteverzuim SET van = $1, tot = $2, opmerking = $3 WHERE id = $4`,
    [van, tot, opmerking, params.verzuimId]
  );
  return NextResponse.json({ success: true });
}
