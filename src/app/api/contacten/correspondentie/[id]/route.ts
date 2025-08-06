// src/app/api/contacten/correspondentie/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const idParam = url.pathname.split('/').pop();
  const id = Number(idParam);

  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: 'ID ontbreekt of ongeldig' }, { status: 400 });
  }

  try {
    await db.query(`DELETE FROM contact_correspondentie WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE_correspondentie] fout:', err);
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
  }
}
