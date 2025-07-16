// Bestand: src/app/api/rapportage/feestdagomzet/route.ts
import { dbRapportage } from '@/lib/dbRapportage';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const datum = url.searchParams.get('datum');

  if (datum) {
    // Uur-op-uur omzet voor een specifieke dag
    const res = await dbRapportage.query(
      `SELECT TO_CHAR(tijdstip, 'HH24:00') AS hour,
              ROUND(SUM(aantal * eenheidsprijs)) AS omzet
         FROM rapportage.omzet
        WHERE datum = $1
        GROUP BY hour
        ORDER BY hour`,
      [datum]
    );
    return NextResponse.json(res.rows);
  }

  try {
    const resultaat = await dbRapportage.query(`
      SELECT
        f.naam AS feestdag,
        EXTRACT(YEAR FROM f.datum) AS jaar,
        ROUND(SUM(o.aantal * o.eenheidsprijs)) AS totaal,
        TO_CHAR(f.datum, 'YYYY-MM-DD') AS datum
      FROM rapportage.feestdagen f
      LEFT JOIN rapportage.omzet o ON o.datum = f.datum
      GROUP BY f.naam, EXTRACT(YEAR FROM f.datum), f.datum
      HAVING SUM(o.aantal * o.eenheidsprijs) IS NOT NULL
      ORDER BY POSITION(f.naam IN '
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
        Dag voor Zomerfeesten
        Zomerfeesten dag 1
        Zomerfeesten dag 2
        Zomerfeesten dag 3
        Zomerfeesten dag 4
        Zomerfeesten dag 5
        Zomerfeesten dag 6
        Zomerfeesten dag 7
      ')
    `);

    return NextResponse.json(resultaat.rows);
  } catch (error) {
    console.error('API fout:', error);
    return NextResponse.json({ error: 'Fout bij ophalen feestdagomzet' }, { status: 500 });
  }
}
