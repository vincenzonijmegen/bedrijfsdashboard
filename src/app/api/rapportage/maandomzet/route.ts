// Bestand: src/app/api/rapportage/maandomzet/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const result = await db.query(`
      SELECT
        EXTRACT(YEAR FROM datum) AS jaar,
        EXTRACT(MONTH FROM datum) AS maand,
        ROUND(SUM(aantal * eenheidsprijs))::int AS omzet
      FROM rapportage.omzet
      GROUP BY jaar, maand
      ORDER BY jaar, maand
    `);

    return NextResponse.json(result.rows);
  } catch (err: any) {
    console.error('Fout bij ophalen maandelijkse omzet:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
