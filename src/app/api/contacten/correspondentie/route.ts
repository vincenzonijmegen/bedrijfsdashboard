// src/app/api/contacten/correspondentie/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const result = await db.query(
    `SELECT id, contact_id, datum, type, omschrijving, bijlage_url
     FROM admin_correspondentie
     ORDER BY datum DESC`
  );
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const { contact_id, datum, type, omschrijving, bijlage_url } = await req.json();

  if (!contact_id || !type) {
    return NextResponse.json({ success: false, error: 'contact_id of type ontbreekt' }, { status: 400 });
  }

  try {
    await db.query(
      `INSERT INTO admin_correspondentie (contact_id, datum, type, omschrijving, bijlage_url)
       VALUES ($1, $2, $3, $4, $5)`,
      [contact_id, datum, type, omschrijving, bijlage_url]
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[POST_correspondentie] fout:', e);
    return NextResponse.json({ success: false, error: 'Opslaan mislukt' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) {
    return NextResponse.json({ success: false, error: 'ID ontbreekt' }, { status: 400 });
  }

  try {
    await db.query(`DELETE FROM admin_correspondentie WHERE id=$1`, [id]);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[DELETE_correspondentie] fout:', e);
    return NextResponse.json({ success: false, error: 'Verwijderen mislukt' }, { status: 500 });
  }
}
