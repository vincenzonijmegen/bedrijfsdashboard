// src/app/api/medewerkers/verzuim/[verzuimId]/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Delete a specific ziekteverzuim entry by its ID
export async function DELETE(request, context) {
  const { verzuimId } = context.params;
  await db.query('DELETE FROM ziekteverzuim WHERE id = $1', [verzuimId]);
  return NextResponse.json({ success: true });
}

// Update a specific ziekteverzuim entry by its ID
export async function PATCH(request, context) {
  const { verzuimId } = context.params;
  const { van, tot, opmerking } = await request.json();
  await db.query(
    `UPDATE ziekteverzuim
       SET van = $1,
           tot = $2,
           opmerking = $3
     WHERE id = $4`,
    [van, tot, opmerking, verzuimId]
  );
  return NextResponse.json({ success: true });
}
