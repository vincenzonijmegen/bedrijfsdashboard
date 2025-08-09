import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET: lijst acties per lijst_id, gesorteerd op voltooid + volgorde
export async function GET(req: NextRequest) {
  const lijst_id = req.nextUrl.searchParams.get('lijst_id');
  if (!lijst_id) {
    return NextResponse.json({ error: 'lijst_id ontbreekt' }, { status: 400 });
  }
  try {
    const acties = await db.query(
      'SELECT * FROM acties WHERE lijst_id = $1 ORDER BY voltooid, volgorde, aangemaakt_op',
      [lijst_id]
    );
    return NextResponse.json(acties.rows);
  } catch (err) {
    console.error('Fout bij ophalen acties:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// POST: nieuwe actie krijgt automatisch de hoogste volgorde binnen de lijst
export async function POST(req: NextRequest) {
  const body = await req.json();
  console.log("VOLGORDE-POST:", body);
  try {
    const { lijst_id, tekst, deadline, verantwoordelijke } = await req.json();
    if (!lijst_id || !tekst) {
      return NextResponse.json({ error: 'lijst_id en tekst zijn verplicht' }, { status: 400 });
    }
    // Bepaal hoogste volgorde binnen deze lijst
    const { rows } = await db.query(
      'SELECT COALESCE(MAX(volgorde), -1) AS max_volgorde FROM acties WHERE lijst_id = $1',
      [lijst_id]
    );
    const nieuweVolgorde = Number(rows[0].max_volgorde) + 1;
    const resultaat = await db.query(
      `INSERT INTO acties (lijst_id, tekst, deadline, verantwoordelijke, volgorde)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [lijst_id, tekst, deadline ?? null, verantwoordelijke ?? null, nieuweVolgorde]
    );
    return NextResponse.json(resultaat.rows[0]);
  } catch (err) {
    console.error('Fout bij toevoegen actie:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PATCH: update actie (tekst, voltooid, volgorde)
export async function PATCH(req: NextRequest) {
  try {
    const { id, tekst, voltooid, volgorde } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'id ontbreekt' }, { status: 400 });
    }
    const resultaat = await db.query(
      `UPDATE acties SET
         tekst = COALESCE($2, tekst),
         voltooid = COALESCE($3::boolean, voltooid),
         volgorde = COALESCE($4::int, volgorde)
       WHERE id = $1
       RETURNING *`,
      [id, tekst ?? null, voltooid ?? null, volgorde ?? null]
    );
    if (resultaat.rows.length === 0) {
      return NextResponse.json({ error: 'Actie niet gevonden' }, { status: 404 });
    }
    return NextResponse.json(resultaat.rows[0]);
  } catch (err) {
    console.error('Fout in PATCH /api/acties:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// DELETE: verwijder actie
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'id ontbreekt' }, { status: 400 });
    }
    const controle = await db.query('SELECT id FROM acties WHERE id = $1', [id]);
    if (controle.rowCount === 0) {
      return NextResponse.json({ error: 'Actie niet gevonden' }, { status: 404 });
    }
    await db.query('DELETE FROM acties WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Fout bij verwijderen actie:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
