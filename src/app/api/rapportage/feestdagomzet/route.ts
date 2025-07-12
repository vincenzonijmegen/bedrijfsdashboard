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
      ORDER BY 
        POSITION(f.naam IN '
          Goede Vrijdag
          1e Paasdag
          2e Paasdag
          1e Pinksterdag
          2e Pinksterdag
          Hemelvaartsdag
          Koningsdag
          Bevrijdingsdag
          Moederdag
          Vaderdag
          meivakantie dag 1
          meivakantie dag 2
          meivakantie dag 3
          meivakantie dag 4
          meivakantie dag 5
          meivakantie dag 6
          meivakantie dag 7
          meivakantie dag 8
          meivakantie dag 9
          Zomerfeesten dag 1
          Zomerfeesten dag 2
          Zomerfeesten dag 3
          Zomerfeesten dag 4
          Zomerfeesten dag 5
          Zomerfeesten dag 6
        ')
    `);

    return NextResponse.json(resultaat.rows);
  } catch (error) {
    console.error('API fout:', error);
    return NextResponse.json({ error: 'Fout bij ophalen feestdagomzet' }, { status: 500 });
  }
}
