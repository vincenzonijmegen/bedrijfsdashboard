// Bestand: src/app/api/rapportage/feestdagomzet/route.ts
import { dbRapportage } from '@/lib/dbRapportage';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const resultaat = await dbRapportage.query(`
      SELECT
        f.naam AS feestdag,
        EXTRACT(YEAR FROM f.datum) AS jaar,
        ROUND(SUM(o.aantal * o.eenheidsprijs)) AS totaal
      FROM rapportage.feestdagen f
      LEFT JOIN rapportage.omzet o ON o.datum = f.datum
      GROUP BY f.naam, EXTRACT(YEAR FROM f.datum)
      HAVING SUM(o.aantal * o.eenheidsprijs) IS NOT NULL
      ORDER BY MIN(f.datum)
    `);

    return NextResponse.json(resultaat.rows);
  } catch (error) {
    console.error('API fout:', error);
    return NextResponse.json({ error: 'Fout bij ophalen feestdagomzet' }, { status: 500 });
  }
}
