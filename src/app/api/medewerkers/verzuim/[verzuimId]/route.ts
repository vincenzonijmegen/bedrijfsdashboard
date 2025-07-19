// src/app/api/medewerkers/verzuim/[verzuimId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(request: NextRequest, context: { params: { verzuimId: string } }) {
  const verzuimId = context.params.verzuimId;
  await db.query('DELETE FROM ziekteverzuim WHERE id = $1', [verzuimId]);
  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest, context: { params: { verzuimId: string } }) {
  const verzuimId = context.params.verzuimId;
  const { van, tot, opmerking } = await request.json();
  await db.query(
    'UPDATE ziekteverzuim SET van = $1, tot = $2, opmerking = $3 WHERE id = $4',
    [van, tot, opmerking, verzuimId]
  );
  return NextResponse.json({ success: true });
}
