// src/app/api/contacten/correspondentie/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 });
  }

  try {
    await db.query(`DELETE FROM contact_correspondentie WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE_correspondentie_id] fout:', err);
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
  }
}
