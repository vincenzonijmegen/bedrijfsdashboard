// src/app/api/contacten/correspondentie/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { del } from '@vercel/blob';

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const idParam = url.pathname.split('/').pop();
  const id = Number(idParam);

  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: 'ID ontbreekt of ongeldig' }, { status: 400 });
  }

  try {
    // Haal de bijlage_url op vóór verwijdering
    const res = await db.query(`SELECT bijlage_url FROM contact_correspondentie WHERE id = $1`, [id]);
    const bijlage_url: string | null = res.rows[0]?.bijlage_url;

    // Verwijder database record
    await db.query(`DELETE FROM contact_correspondentie WHERE id = $1`, [id]);

    // Verwijder bestand uit blob storage als er een bijlage was
    if (bijlage_url) {
      const blobPath = new URL(bijlage_url).pathname.slice(1); // verwijder leading slash
      await del(blobPath);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE_correspondentie] fout:', err);
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
  }
}
