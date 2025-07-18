// src/app/api/rapportage/omzet/import/route.ts

import { dbRapportage } from '@/lib/dbRapportage';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

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
      // Al ISO-formaat
      return `${parts[0]}-${parts[1]}-${parts[2]}`;
    }
    // Anders DD-MM-YYYY
    const [d, m, y] = parts;
    return `${y}-${m}-${d}`;
  };
  const isoStart = normalizeDate(startParam);
  const isoEinde = normalizeDate(eindeParam);

  const baseUrl = process.env.KASSA_API_URL!;
  const username = process.env.KASSA_USER!;
  const password = process.env.KASSA_PASS!;

  try {
    // Ophalen van de data met Basic Auth
    const dataUrl = `${baseUrl}?start=${encodeURIComponent(startParam)}&einde=${encodeURIComponent(eindeParam)}`;
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    console.log('Fetching data from:', dataUrl);

    const dataRes = await fetch(dataUrl, {
      headers: { Authorization: authHeader },
    });
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

    // Filter en parse records
    const clean = data
      .filter((row: any) => row.Datum && row.Tijd && row.Omschrijving && row.Aantal && row.Totaalbedrag)
      .map((row: any) => {
        const datum = normalizeDate(row.Datum as string);
        return {
          datum,
          tijdstip: row.Tijd as string,
          product: row.Omschrijving as string,
          aantal: parseInt((row.Aantal as string).replace(/\D+/g, ''), 10),
          eenheidsprijs: parseFloat((row.Totaalbedrag as string).replace(/\./g, '').replace(',', '.')),
        };
      });

    // Analyse van aangeboden data voor duplicaten:
    const dateCounts: Record<string, number> = {};
    clean.forEach(({ datum }) => {
      dateCounts[datum] = (dateCounts[datum] || 0) + 1;
    });
    console.log('Aantal records per datum:', dateCounts);

    const seenKeys = new Set<string>();
    const duplicateKeys: string[] = [];
    clean.forEach(({ datum, tijdstip, product }) => {
      const key = `${datum}|${tijdstip}|${product}`;
      if (seenKeys.has(key)) {
        duplicateKeys.push(key);
      } else {
        seenKeys.add(key);
      }
    });
    console.log('Gevonden duplicaten binnen data:', duplicateKeys);

    // Verwijder bestaande data in de range
    console.log('Verwijder oude records van', isoStart, 'tot', isoEinde);
    await dbRapportage.query(
      'DELETE FROM rapportage.omzet WHERE datum BETWEEN $1 AND $2',
      [isoStart, isoEinde]
    );

    if (clean.length === 0) {
      console.log('Geen nieuwe records om in te voegen');
      return NextResponse.json({ success: true, imported: 0 });
    }

    // Bulk insert
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

    console.log('Import geslaagd');
    return NextResponse.json({ success: true, imported: clean.length });
  } catch (err: any) {
    console.error('Import fout:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
