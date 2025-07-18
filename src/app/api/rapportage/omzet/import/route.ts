// src/app/api/rapportage/omzet/import/route.ts

import { dbRapportage } from '@/lib/dbRapportage';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const einde = searchParams.get('einde');

  if (!start || !einde) {
    return NextResponse.json(
      { success: false, error: 'start of einde ontbreekt' },
      { status: 400 }
    );
  }

  const baseUrl = process.env.KASSA_API_URL!; // b.v. https://mijn-domein.example.com/admin/api.php
  const username = process.env.KASSA_USER!;
  const password = process.env.KASSA_PASS!;

  try {
    // 1. Authenticatie via formulier en cookie-opslaan
    const loginRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ password })
    });
    if (!loginRes.ok) {
      throw new Error(`Login naar kassa-API failed: ${loginRes.status}`);
    }

    const cookie = loginRes.headers.get('set-cookie');
    if (!cookie) {
      throw new Error('Geen session-cookie ontvangen na login');
    }

    // 2. Data ophalen met sessie-cookie
    const dataRes = await fetch(
      `${baseUrl}?start=${encodeURIComponent(start)}&einde=${encodeURIComponent(einde)}`,
      {
        method: 'GET',
        headers: {
          Cookie: cookie
        }
      }
    );
    const contentType = dataRes.headers.get('content-type') || '';
    const bodyText = await dataRes.text();

    if (!dataRes.ok) {
      console.error('Data fetch error', dataRes.status, bodyText);
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

    // 3. Opruimen en parsen
    const clean = data
      .filter(row => row.Datum && row.Tijd && row.Omschrijving && row.Aantal && row.Totaalbedrag)
      .map(row => ({
        datum: row.Datum,
        tijdstip: row.Tijd,
        product: row.Omschrijving,
        aantal: parseInt(row.Aantal.replace(/\D+/g, ''), 10),
        eenheidsprijs: parseFloat(row.Totaalbedrag.replace(/\./g, '').replace(',', '.'))
      }));

    // 4. Oude data verwijderen in range
    await dbRapportage.query(
      `DELETE FROM rapportage.omzet WHERE datum BETWEEN $1 AND $2`,
      [start, einde]
    );

    // 5. Bulk insert nieuwe data
    if (clean.length === 0) {
      return NextResponse.json({ success: true, imported: 0 });
    }

    const placeholders: string[] = [];
    const values: any[] = [];
    clean.forEach((item, i) => {
      const off = i * 5;
      placeholders.push(`($${off+1}, $${off+2}, $${off+3}, $${off+4}, $${off+5})`);
      values.push(item.datum, item.tijdstip, item.product, item.aantal, item.eenheidsprijs);
    });

    const insertSQL = `
      INSERT INTO rapportage.omzet (datum, tijdstip, product, aantal, eenheidsprijs)
      VALUES ${placeholders.join(',')}
    `;
    await dbRapportage.query(insertSQL, values);

    return NextResponse.json({ success: true, imported: clean.length });
  } catch (err: any) {
    console.error('Import fout:', err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
