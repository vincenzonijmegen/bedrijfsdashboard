// Bestand: src/app/api/acties/route.ts
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET: lijst acties per lijst_id
export async function GET(req: NextRequest) {
  const lijst_id = req.nextUrl.searchParams.get("lijst_id");
  if (!lijst_id) {
    return NextResponse.json({ error: "lijst_id ontbreekt" }, { status: 400 });
  }

  try {
    const acties = await db.query(
      'SELECT * FROM acties WHERE lijst_id = $1 ORDER BY voltooid, aangemaakt_op',
      [lijst_id]
    );
    return NextResponse.json(acties.rows);
  } catch (err) {
    console.error("Fout bij ophalen acties:", err);
    return NextResponse.json({ error: "Interne serverfout" }, { status: 500 });
  }
}

// POST: nieuwe actie
export async function POST(req: NextRequest) {
  try {
    const { lijst_id, tekst, deadline, verantwoordelijke } = await req.json();
    if (!lijst_id || !tekst) {
      return NextResponse.json({ error: "lijst_id en tekst zijn verplicht" }, { status: 400 });
    }

    const resultaat = await db.query(
      `INSERT INTO acties (lijst_id, tekst, deadline, verantwoordelijke)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [lijst_id, tekst, deadline ?? null, verantwoordelijke ?? null]
    );

    return NextResponse.json(resultaat.rows[0]);
  } catch (err) {
    console.error("Fout bij toevoegen actie:", err);
    return NextResponse.json({ error: "Interne serverfout" }, { status: 500 });
  }
}

// PATCH: update actie
export async function PATCH(req: NextRequest) {
  try {
    const { id, tekst, voltooid, volgorde } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "id ontbreekt" }, { status: 400 });
    }

    const resultaat = await db.query(
      `UPDATE acties SET
        tekst = COALESCE($2, tekst),
        voltooid = CASE WHEN $3 IS NOT NULL THEN $3::boolean ELSE voltooid END,
        volgorde = COALESCE($4, volgorde)
       WHERE id = $1
       RETURNING *`,
      [id, tekst ?? null, voltooid ?? null, volgorde ?? null]
    );

    if (resultaat.rows.length === 0) {
      return NextResponse.json({ error: "Actie niet gevonden" }, { status: 404 });
    }

    return NextResponse.json(resultaat.rows[0]);
  } catch (err) {
    console.error("Fout in PATCH /api/acties:", err);
    return NextResponse.json({ error: "Interne serverfout" }, { status: 500 });
  }
}

// DELETE: verwijder actie
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "id ontbreekt" }, { status: 400 });
    }

    const controle = await db.query('SELECT id FROM acties WHERE id = $1', [id]);
    if (controle.rowCount === 0) {
      return NextResponse.json({ error: "Actie niet gevonden" }, { status: 404 });
    }

    await db.query('DELETE FROM acties WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Fout bij verwijderen actie:", err);
    return NextResponse.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
