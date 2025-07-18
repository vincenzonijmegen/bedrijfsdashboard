// src/app/api/rapportage/omzet/import/route.ts

import { dbRapportage } from '@/lib/dbRapportage';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const einde = searchParams.get('einde');

  if (!start || !einde) {
    return NextResponse.json({ success: false, error: 'start of einde ontbreekt' }, { status: 400 });
  }

  const baseUrl = process.env.KASSA_API_URL!; // https://89.98.65.61/admin/api.php
  const username = process.env.KASSA_USER!;
  const password = process.env.KASSA_PASS!;

  try {
    // Eenvoudige Basic-auth direct voor data-endpoint
    const dataUrl = `${baseUrl}?start=${encodeURIComponent(start)}&einde=${encodeURIComponent(einde)}`;
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    // Fetch data met Basic auth
    const dataRes = await fetch(dataUrl, { headers: { Authorization: authHeader } });
    const bodyText = await dataRes.text();
    const contentType = dataRes.headers.get('content-type') || '';

    if (!dataRes.ok) {
      console.error('Data fetch failed', dataRes.status, bodyText);
      throw new Error(`API error: ${dataRes.status}`);
    }
    if (!contentType.includes('application/json')) {
      console.error('Expected JSON but got:', contentType, bodyText);
      throw new Error('Ongeldig antwoord van API: geen JSON');
    }

    const data = JSON.parse(bodyText);
    if (!Array.isArray(data)) {
      throw new Error('API returned geen array');
    }

    // Opruimen en parsen
    const clean = data
      .filter(row => row.Datum && row.Tijd && row.Omschrijving && row.Aantal && row.Totaalbedrag)
      .map(row => ({
        datum: row.Datum,
        tijdstip: row.Tijd,
        product: row.Omschrijving,
        aantal: parseInt(row.Aantal.replace(/\D+/g, ''), 10),
        eenheidsprijs: parseFloat(row.Totaalbedrag.replace(/\./g, '').replace(',', '.'))
      }));

    // Oude data verwijderen
    await dbRapportage.query(
      'DELETE FROM rapportage.omzet WHERE datum BETWEEN $1 AND $2',
      [start, einde]
    );

    // Bulk insert
    if (clean.length === 0) return NextResponse.json({ success: true, imported: 0 });

    const placeholders: string[] = [];
    const values: any[] = [];
    clean.forEach((item, i) => {
      const off = i * 5;
      placeholders.push(`($${off+1}, $${off+2}, $${off+3}, $${off+4}, $${off+5})`);
      values.push(item.datum, item.tijdstip, item.product, item.aantal, item.eenheidsprijs);
    });

    await dbRapportage.query(
      `INSERT INTO rapportage.omzet (datum, tijdstip, product, aantal, eenheidsprijs)
       VALUES ${placeholders.join(',')}`,
      values
    );

    return NextResponse.json({ success: true, imported: clean.length });
  } catch (err: any) {
    console.error('Import fout:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
