// src/app/api/rapportage/omzet/import/route.ts

import { dbRapportage } from '@/lib/dbRapportage';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

// For self-signed certificates, you can disable SSL verification (not recommended for production)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const einde = searchParams.get('einde');

  console.log('Import start:', { start, einde });
  // Normalize start/einde for SQL (expect DD-MM-YYYY)
  const normalize = (dateStr: string) => {
    const [d, m, y] = dateStr.split('-').map(part => part.padStart(2, '0'));
    return `${y}-${m}-${d}`;
  };
  const isoStart = normalize(start);
  const isoEinde = normalize(einde);

  if (!start || !einde) { || !einde) {
    console.error('Missing params', { start, einde });
    return NextResponse.json({ success: false, error: 'start of einde ontbreekt' }, { status: 400 });
  }

  const baseUrl = process.env.KASSA_API_URL!;
  const username = process.env.KASSA_USER!;
  const password = process.env.KASSA_PASS!;

  try {
    const dataUrl = `${baseUrl}?start=${encodeURIComponent(start)}&einde=${encodeURIComponent(einde)}`;
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    console.log('Fetching data from:', dataUrl);

    const dataRes = await fetch(dataUrl, { headers: { Authorization: authHeader } });
    const bodyText = await dataRes.text();
    const contentType = dataRes.headers.get('content-type') || '';

    console.log('Response status:', dataRes.status, 'content-type:', contentType);

    if (!dataRes.ok) {
      console.error('Data fetch failed', dataRes.status, bodyText);
      throw new Error(`API error: ${dataRes.status}`);
    }
    if (!contentType.includes('application/json')) {
      console.error('Expected JSON but got:', contentType, bodyText);
      throw new Error('Ongeldig antwoord van API: geen JSON');
    }

    const data = JSON.parse(bodyText);
    console.log('Parsed JSON length:', Array.isArray(data) ? data.length : 'invalid');
    if (!Array.isArray(data)) {
      throw new Error('API returned geen array');
    }

    // 2. Normalize and filter data
    const clean = data
      .filter(
        (row: any) => row.Datum && row.Tijd && row.Omschrijving && row.Aantal && row.Totaalbedrag
      )
      .map((row: any) => {
        // Datum expected format 'DD-MM-YYYY' or 'D-M-YYYY'
        const [d, m, y] = row.Datum.split('-').map((part: string) => part.padStart(2, '0'));
        const datum = `${y}-${m}-${d}`; // ISO format
        const tijdstip = row.Tijd as string;
        const product = row.Omschrijving as string;
        const aantal = parseInt((row.Aantal as string).replace(/\D+/g, ''), 10);
        const eenheidsprijs = parseFloat(
          (row.Totaalbedrag as string).replace(/\./g, '').replace(',', '.')
        );
        return { datum, tijdstip, product, aantal, eenheidsprijs };
      });

    // 3. Delete existing records for this date range
    console.log('Deleting existing records between', start, 'and', einde);
    await dbRapportage.query(
      'DELETE FROM rapportage.omzet WHERE datum BETWEEN $1 AND $2',
      [start, einde]
    );

    // 4. Bulk insert new records
    if (clean.length === 0) {
      console.log('No records to insert');
      return NextResponse.json({ success: true, imported: 0 });
    }

    console.log('Inserting', clean.length, 'records');
    const placeholders: string[] = [];
    const values: any[] = [];
    clean.forEach((item, i) => {
      const off = i * 5;
      placeholders.push(`($${off + 1}, $${off + 2}, $${off + 3}, $${off + 4}, $${off + 5})`);
      values.push(item.datum, item.tijdstip, item.product, item.aantal, item.eenheidsprijs);
    });

    await dbRapportage.query(
      `INSERT INTO rapportage.omzet (datum, tijdstip, product, aantal, eenheidsprijs)
       VALUES ${placeholders.join(',')}`,
      values
    );

    console.log('Import succeeded');
    return NextResponse.json({ success: true, imported: clean.length });
  } catch (err: any) {
    console.error('Import fout:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
