// ✅ POST-handler fixen: controleer of er daadwerkelijk een POST plaatsvindt

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: any, context: any) {
  try {
    const medewerkerId = context.params.id;
    const body = await request.json();
    const { van, tot, opmerking } = body;

    if (!van || !tot) {
      return NextResponse.json({ error: 'Ongeldige invoer: ontbrekende datum' }, { status: 400 });
    }

    await db.query(
      'INSERT INTO ziekteverzuim (medewerker_id, van, tot, opmerking) VALUES ($1, $2, $3, $4)',
      [medewerkerId, van, tot, opmerking || '']
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Fout bij POST /verzuim:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
