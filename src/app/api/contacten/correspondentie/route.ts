// src/app/api/contacten/correspondentie/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const res = await db.query(
      `SELECT id, contact_id, datum, type, omschrijving, bijlage_url
       FROM contact_correspondentie
       ORDER BY datum DESC, id DESC`
    );
    return NextResponse.json(res.rows);
  } catch (err) {
    console.error('[GET_correspondentie] fout:', err);
    return NextResponse.json({ error: 'Databasefout' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { contact_id, datum, type, omschrijving, bijlage_url } = await req.json();

    if (!contact_id || !type) {
      console.warn('[POST_correspondentie] ontbrekende velden:', { contact_id, type });
      return NextResponse.json({ error: 'contact_id of type ontbreekt' }, { status: 400 });
    }

    console.log('[POST_correspondentie] ontvangen:', { contact_id, datum, type, omschrijving, bijlage_url });

    const res = await db.query(
      `INSERT INTO contact_correspondentie
         (contact_id, datum, type, omschrijving, bijlage_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, contact_id, datum, type, omschrijving, bijlage_url`,
      [contact_id, datum || new Date().toISOString().split('T')[0], type, omschrijving, bijlage_url || null]
    );

    return NextResponse.json(res.rows[0]);
  } catch (err) {
    console.error('[POST_correspondentie] fout:', err);
    return NextResponse.json({ error: 'Toevoegen mislukt' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, datum, type, omschrijving, bijlage_url } = await req.json();

    if (!id || !type) {
      console.warn('[PUT_correspondentie] ontbrekende velden:', { id, type });
      return NextResponse.json({ error: 'ID of type ontbreekt' }, { status: 400 });
    }

    const res = await db.query(
      `UPDATE contact_correspondentie
         SET datum = $1,
             type = $2,
             omschrijving = $3,
             bijlage_url = $4
       WHERE id = $5
       RETURNING id, contact_id, datum, type, omschrijving, bijlage_url`,
      [datum || new Date().toISOString().split('T')[0], type, omschrijving, bijlage_url || null, id]
    );

    return NextResponse.json(res.rows[0]);
  } catch (err) {
    console.error('[PUT_correspondentie] fout:', err);
    return NextResponse.json({ error: 'Update mislukt' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = Number(req.nextUrl.searchParams.get('id'));
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'ID ontbreekt of ongeldig' }, { status: 400 });
    }

    await db.query(`DELETE FROM contact_correspondentie WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE_correspondentie] fout:', err);
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
  }
}
