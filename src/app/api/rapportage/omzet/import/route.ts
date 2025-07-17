// src/app/api/rapportage/omzet/import/route.ts

import { dbRapportage } from '@/lib/dbRapportage';
import { NextResponse } from 'next/server';

export async function POST() {
  const apiUrl = 'https://www.pcadmin.nl/kassaapp/api.php?start=14-07-2024&einde=15-07-2025';
  const username = process.env.KASSA_USER!;
  const password = process.env.KASSA_PASS!;

  try {
    // 1. Haal alle unieke datums op die al in de tabel bestaan
    const existingDatesRes = await dbRapportage.query(
      `SELECT DISTINCT datum FROM rapportage.omzet`
    );
    const existingDates = new Set(
      existingDatesRes.rows.map(r => r.datum.toISOString().slice(0, 10))
    );

    // 2. Ophalen en filteren van externe data
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

    // 3. Opschonen en filteren van records
    const clean = data
      .filter(
        row =>
          row.Datum &&
          row.Tijd &&
          row.Omschrijving &&
          row.Aantal &&
          row.Totaalbedrag
      )
      .map(row => ({
        datum: row.Datum,
        tijdstip: row.Tijd,
        product: row.Omschrijving,
        aantal: parseInt(row.Aantal, 10),
        eenheidsprijs: parseFloat(row.Totaalbedrag.replace(',', '.')),
      }))
      // 4. Alleen nieuwe datums toevoegen
      .filter(item => !existingDates.has(item.datum));

    // 5. Insert van gefilterde records
    await Promise.all(
      clean.map(item =>
        dbRapportage.query(
          `
          INSERT INTO rapportage.omzet (datum, tijdstip, product, aantal, eenheidsprijs)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
          `,
          [
            item.datum,
            item.tijdstip,
            item.product,
            item.aantal,
            item.eenheidsprijs,
          ]
        )
      )
    );

    return NextResponse.json({ success: true, imported: clean.length });
  } catch (err: any) {
    console.error('Import fout:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
