// ✅ WERKEND: verzuimroute accepteert e-mailadres en zoekt medewerker_id op

// src/app/api/medewerkers/[id]/verzuim/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: any, context: any) {
  const email = context.params.id;
  const result = await db.query(
    `SELECT * FROM ziekteverzuim WHERE medewerker_id = (
      SELECT id FROM medewerkers WHERE email = $1
    ) ORDER BY van DESC`,
    [email]
  );
  return NextResponse.json(result.rows);
}

export async function POST(request: any, context: any) {
  try {
    const email = context.params.id;
    const { van, tot, opmerking } = await request.json();

    if (!van) {
      return NextResponse.json({ error: 'Ongeldige invoer: ontbrekende startdatum' }, { status: 400 });
    }

    const result = await db.query('SELECT id FROM medewerkers WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Geen medewerker gevonden' }, { status: 404 });
    }
    const medewerkerId = result.rows[0].id;

    await db.query(
      'INSERT INTO ziekteverzuim (medewerker_id, van, tot, opmerking) VALUES ($1, $2, $3, $4)',
      [medewerkerId, van, tot || null, opmerking || '']
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Fout bij POST /verzuim:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
