// Bestand: src/app/api/rapportage/maandomzet/route.ts
import { dbRapportage } from '@/lib/dbRapportage';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';


export async function GET() {
  try {
    const omzet = await dbRapportage.query(`
      SELECT 
        EXTRACT(YEAR FROM datum) AS jaar,
        DATE_TRUNC('month', datum) AS maand_start,
        ROUND(SUM(aantal * eenheidsprijs)) AS totaal
      FROM rapportage.omzet
      GROUP BY jaar, maand_start
      ORDER BY maand_start
    `);
    const maxDatum = await dbRapportage.query(`SELECT MAX(datum) AS max_datum FROM rapportage.omzet`);
    return NextResponse.json({ rows: omzet.rows, max_datum: maxDatum.rows[0].max_datum });
  } catch (err) {
    console.error('API maandomzet fout:', err);
    return NextResponse.json({ error: 'Fout bij ophalen maandomzet' }, { status: 500 });
  }
}




