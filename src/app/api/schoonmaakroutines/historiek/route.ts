// Bestand: src/app/api/schoonmaakroutines/historiek/route.ts
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET: haal historiek op voor een routine
export async function GET(req: NextRequest) {
  const routine_id = req.nextUrl.searchParams.get('routine_id');
  if (!routine_id) {
    return NextResponse.json({ error: 'routine_id ontbreekt' }, { status: 400 });
  }
  try {
    const result = await db.query(
      `SELECT datum FROM schoonmaak_log WHERE routine_id = $1 ORDER BY datum DESC`,
      [routine_id]
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('Fout bij ophalen historiek:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// DELETE: verwijder een specifieke historiek-entry
export async function DELETE(req: NextRequest) {
  try {
    const { routine_id, datum } = await req.json();
    if (!routine_id || !datum) {
      return NextResponse.json({ error: 'routine_id en datum zijn verplicht' }, { status: 400 });
    }
    await db.query(
      `DELETE FROM schoonmaak_log WHERE routine_id = $1 AND datum = $2`,
      [routine_id, datum]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Fout bij verwijderen historiek-entry:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
