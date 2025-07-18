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

  // 1. Externe API call
  const baseUrl = process.env.KASSA_API_URL!;
  const apiUrl = `${baseUrl}?start=${encodeURIComponent(start)}&einde=${encodeURIComponent(einde)}`;
  const username = process.env.KASSA_USER!;
  const password = process.env.KASSA_PASS!;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Authorization:
          'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
      },
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('API returned geen array');
    }

    // 2. Opruimen en parsen
    const clean = data
      .filter(
        row => row.Datum && row.Tijd && row.Omschrijving && row.Aantal && row.Totaalbedrag
      )
      .map(row => {
        const datum = row.Datum;
        const tijdstip = row.Tijd;
        const product = row.Omschrijving;
        const aantal = parseInt(row.Aantal.replace(/\D+/g, ''), 10);
        const eenheidsprijs = parseFloat(
          row.Totaalbedrag.replace(/\./g, '').replace(',', '.')
        );
        return { datum, tijdstip, product, aantal, eenheidsprijs };
      });

    // 3. Verwijder bestaande records voor deze datums
    // We gaan ervan uit dat start en einde in ISO YYYY-MM-DD zijn
    await dbRapportage.query(
      `DELETE FROM rapportage.omzet
       WHERE datum BETWEEN $1 AND $2`,
      [start, einde]
    );

    // 4. Bulk insert van alle nieuwe records
    if (clean.length === 0) {
      return NextResponse.json({ success: true, imported: 0 });
    }

    const placeholders: string[] = [];
    const values: any[] = [];
    clean.forEach((item, i) => {
      const off = i * 5;
      placeholders.push(`($${off + 1}, $${off + 2}, $${off + 3}, $${off + 4}, $${off + 5})`);
      values.push(item.datum, item.tijdstip, item.product, item.aantal, item.eenheidsprijs);
    });

    const insertSQL = `
      INSERT INTO rapportage.omzet (datum, tijdstip, product, aantal, eenheidsprijs)
      VALUES ${placeholders.join(',')}
    `;
    await dbRapportage.query(insertSQL, values);

    return NextResponse.json({ success: true, imported: clean.length });
  } catch (err: any) {
    console.error('Import fout:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
