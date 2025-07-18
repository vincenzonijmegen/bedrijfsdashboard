// src/app/api/rapportage/omzet/import/route.ts

import { dbRapportage } from '@/lib/dbRapportage';
import { NextResponse } from 'next/server';

export async function POST() {
  const apiUrl = 'http://192.168.178.191/admin/api.php';
  const username = process.env.KASSA_USER!;
  const password = process.env.KASSA_PASS!;

  try {
    // 1. Bestaande records per unieke combinatie ophalen
    const existingRes = await dbRapportage.query(
      `SELECT datum, tijdstip, product
       FROM rapportage.omzet`
    );
    const existingSet = new Set(
      existingRes.rows.map(r =>
        `${r.datum.toISOString().slice(0, 10)}|${r.tijdstip}|${r.product}`
      )
    );

    // 2. Externe data ophalen
    const response = await fetch(apiUrl, {
      headers: {
        Authorization:
          'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
      },
    });
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('API returned geen array');
    }

    // 3. Opruimen, parsen en filteren per record
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
      })
      .filter(item =>
        !existingSet.has(
          `${item.datum}|${item.tijdstip}|${item.product}`
        )
      );

    if (clean.length === 0) {
      return NextResponse.json({ success: true, imported: 0 });
    }

    // 4. Batch insert met ON CONFLICT target
    const valuesPlaceholders: string[] = [];
    const values: any[] = [];

    clean.forEach((item, idx) => {
      const offset = idx * 5;
      valuesPlaceholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
      );
      values.push(
        item.datum,
        item.tijdstip,
        item.product,
        item.aantal,
        item.eenheidsprijs
      );
    });

    const insertQuery = `
      INSERT INTO rapportage.omzet (datum, tijdstip, product, aantal, eenheidsprijs)
      VALUES ${valuesPlaceholders.join(',')}
      ON CONFLICT (datum, tijdstip, product) DO NOTHING
    `;

    await dbRapportage.query(insertQuery, values);

    return NextResponse.json({ success: true, imported: clean.length });
  } catch (err: any) {
    console.error('Import fout:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
