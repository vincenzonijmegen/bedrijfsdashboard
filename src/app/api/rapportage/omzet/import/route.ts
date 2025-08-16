// src/app/api/rapportage/omzet/import/route.ts

import { dbRapportage } from '@/lib/dbRapportage';
import { NextResponse, NextRequest } from 'next/server';
import { refreshOmzetMaand } from '@/lib/refreshOmzetMaand';

// Voor zelf-ondertekende certificaten (NIET aanbevolen voor productie)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get('start');
  const eindeParam = searchParams.get('einde');

  console.log('Import start parameters:', { startParam, eindeParam });
  if (!startParam || !eindeParam) {
    console.error('Ontbrekende start of einde parameter');
    return NextResponse.json(
      { success: false, error: 'start of einde ontbreekt' },
      { status: 400 }
    );
  }

  // Normalizeer DD-MM-YYYY of ISO YYYY-MM-DD naar YYYY-MM-DD
  const normalizeDate = (dateStr: string) => {
    const parts = dateStr.split('-').map((s) => s.padStart(2, '0'));
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1]}-${parts[2]}`;
    }
    const [d, m, y] = parts;
    return `${y}-${m}-${d}`;
  };
  const isoStart = normalizeDate(startParam);
  const isoEinde = normalizeDate(eindeParam);

  const baseUrl = process.env.KASSA_API_URL!;
  const username = process.env.KASSA_USER!;
  const password = process.env.KASSA_PASS!;

  try {
    // 1) Externe data ophalen (Basic Auth)
    const dataUrl = `${baseUrl}?start=${encodeURIComponent(startParam)}&einde=${encodeURIComponent(eindeParam)}`;
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    console.log('Fetching data from:', dataUrl);

    const dataRes = await fetch(dataUrl, { headers: { Authorization: authHeader } });
    const rawBody = await dataRes.text();
    const contentType = dataRes.headers.get('content-type') || '';

    console.log('Response status:', dataRes.status, 'Content-Type:', contentType);
    if (!dataRes.ok) {
      console.error('Fetch failed:', dataRes.status, rawBody);
      throw new Error(`API error: ${dataRes.status}`);
    }
    if (!contentType.includes('application/json')) {
      console.error('Ongeldig content-type:', contentType, rawBody);
      throw new Error('Ongeldig antwoord van API: geen JSON');
    }

    const data = JSON.parse(rawBody);
    if (!Array.isArray(data)) {
      console.error('Verwachte array, kreeg:', data);
      throw new Error('API returned geen array');
    }
    console.log('Gedecodeerde items:', data.length);

    // 2) Filteren/parsen, bereken eenheidsprijs
    const clean = data
      .filter((row: any) => row.Datum && row.Tijd && row.Omschrijving && row.Aantal && row.Totaalbedrag)
      .map((row: any) => {
        const datum = normalizeDate(row.Datum as string);
        const aantal = parseInt((row.Aantal as string).replace(/\D+/g, ''), 10);
        const totaalBedrag = parseFloat((row.Totaalbedrag as string).replace(/\./g, '').replace(',', '.'));
        const eenheidsprijs = aantal > 0 ? totaalBedrag / aantal : 0;
        return {
          datum,
          tijdstip: row.Tijd as string,      // Postgres mag dit casten naar TIME
          product: row.Omschrijving as string,
          aantal,
          eenheidsprijs,
        };
      });

    // 3) Oude omzetregels in range verwijderen + nieuwe inserten
    console.log('Verwijder oude records van', isoStart, 'tot', isoEinde);
    await dbRapportage.query(
      'DELETE FROM rapportage.omzet WHERE datum BETWEEN $1 AND $2',
      [isoStart, isoEinde]
    );

    if (clean.length > 0) {
      console.log('Invoegen van', clean.length, 'records');
      const placeholders: string[] = [];
      const values: any[] = [];
      clean.forEach((item, idx) => {
        const off = idx * 5;
        placeholders.push(`($${off + 1}, $${off + 2}, $${off + 3}, $${off + 4}, $${off + 5})`);
        values.push(item.datum, item.tijdstip, item.product, item.aantal, item.eenheidsprijs);
      });
      const insertSQL = `
        INSERT INTO rapportage.omzet (datum, tijdstip, product, aantal, eenheidsprijs)
        VALUES ${placeholders.join(',')}
      `;
      await dbRapportage.query(insertSQL, values);
    } else {
      console.log('Geen nieuwe records om in te voegen');
    }

    // 5) Kwartier-aggregatie in dezelfde range (idempotent: delete + insert)
    console.log('Herbouw kwartieren', isoStart, 't/m', isoEinde);
    await dbRapportage.query(
      `DELETE FROM rapportage.omzet_kwartier
       WHERE datum BETWEEN $1::date AND $2::date`,
      [isoStart, isoEinde]
    );

    const kwartierInsert = await dbRapportage.query(
      `INSERT INTO rapportage.omzet_kwartier
         (datum, uur, kwartier, omzet, aantal_transacties)
       SELECT
         DATE(o.datum)                                            AS datum,
         EXTRACT(HOUR   FROM (o.tijdstip)::time)::int             AS uur,
         FLOOR(EXTRACT(MINUTE FROM (o.tijdstip)::time)::int / 15) + 1 AS kwartier, -- 1..4
         SUM(o.aantal * o.eenheidsprijs)                          AS omzet,
         COUNT(*)                                                 AS aantal_transacties
       FROM rapportage.omzet o
       WHERE o.datum BETWEEN $1::date AND $2::date
       GROUP BY 1,2,3
       ORDER BY 1,2,3`,
      [isoStart, isoEinde]
    );

    // 6) MV verversen (zoals je al had)
    try {
      await refreshOmzetMaand();
    } catch (e) {
      console.error('MV refresh fout (omzet_maand):', e);
      // Niet laten falen; rapportage is hooguit een import achter
    }

    console.log('Import + kwartieren geslaagd');
    return NextResponse.json({
      success: true,
      imported: clean.length,
      kwartieren_inserted: kwartierInsert.rowCount ?? 0,
      range: { start: isoStart, einde: isoEinde },
    });
  } catch (err: any) {
    console.error('Import fout:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
