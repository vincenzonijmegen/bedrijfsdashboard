// src/app/api/contacten/correspondentie/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET: alle correspondentie ophalen, gegroepeerd op contact_id
export async function GET() {
  try {
    const res = await db.query(
      `SELECT id, contact_id, datum, type, omschrijving, bijlage_url
       FROM contact_correspondentie
       ORDER BY datum DESC, id DESC`
    );
    return NextResponse.json(res.rows);
  } catch (err) {
    console.error('Fout bij ophalen correspondentie:', err);
    return NextResponse.json({ error: 'Databasefout' }, { status: 500 });
  }
}

// POST: nieuwe correspondentie toevoegen
export async function POST(req: NextRequest) {
  try {
    const { contact_id, datum, type, omschrijving, bijlage_url } = await req.json();
    const res = await db.query(
      `INSERT INTO contact_correspondentie
         (contact_id, datum, type, omschrijving, bijlage_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, contact_id, datum, type, omschrijving, bijlage_url`,
      [contact_id, datum || new Date().toISOString().split('T')[0], type, omschrijving, bijlage_url || null]
    );
    return NextResponse.json(res.rows[0]);
  } catch (err) {
    console.error('Fout bij toevoegen correspondentie:', err);
    return NextResponse.json({ error: 'Toevoegen mislukt' }, { status: 500 });
  }
}

// PUT: bestaande correspondentie bijwerken
export async function PUT(req: NextRequest) {
  try {
    const { id, datum, type, omschrijving, bijlage_url } = await req.json();
    const res = await db.query(
      `UPDATE contact_correspondentie
         SET datum = $1,
             type = $2,
             omschrijving = $3,
             bijlage_url = $4
       WHERE id = $5
       RETURNING id, contact_id, datum, type, omschrijving, bijlage_url`,
      [datum, type, omschrijving, bijlage_url || null, id]
    );
    return NextResponse.json(res.rows[0]);
  } catch (err) {
    console.error('Fout bij bijwerken correspondentie:', err);
    return NextResponse.json({ error: 'Update mislukt' }, { status: 500 });
  }
}

// DELETE: correspondentie verwijderen
export async function DELETE(req: NextRequest) {
  try {
    const id = Number(req.nextUrl.searchParams.get('id'));
    if (!id) {
      return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 });
    }
    await db.query(`DELETE FROM contact_correspondentie WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Fout bij verwijderen correspondentie:', err);
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
  }
}
