// Bestand: src/app/api/schoonmaakroutines/historiek/route.ts
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const routine_id = req.nextUrl.searchParams.get("routine_id");

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
    console.error("Fout bij ophalen historiek:", err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
