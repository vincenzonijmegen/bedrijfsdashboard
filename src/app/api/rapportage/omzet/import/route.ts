// src/app/api/rapportage/omzet/import/route.ts
import { dbRapportage } from '@/lib/dbRapportage';
import { NextResponse } from 'next/server';

export async function POST() {
  const apiUrl = 'https://www.pcadmin.nl/kassaapp/api.php?start=14-07-2024&einde=15-07-2025';
  const username = process.env.KASSA_USER!;
  const password = process.env.KASSA_PASS!;

  try {
    // 1) Count vóór insert
    const before = await dbRapportage.query(
      `SELECT COUNT(*) AS cnt FROM rapportage.omzet`
    );
    const countBefore = parseInt(before.rows[0].cnt, 10);

    // 2) Ophalen en filteren van externe data
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
      }));

    // 3) Opslaan (zonder ON CONFLICT, om zeker te zijn)
    await Promise.all(
      clean.map(item =>
        dbRapportage.query(
          `
          INSERT INTO rapportage.omzet
            (datum, tijdstip, product, aantal, eenheidsprijs)
          VALUES ($1, $2, $3, $4, $5)
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

    // 4) Count ná insert
    const after = await dbRapportage.query(
      `SELECT COUNT(*) AS cnt FROM rapportage.omzet`
    );
    const countAfter = parseInt(after.rows[0].cnt, 10);

    return NextResponse.json({
      success: true,
      imported: clean.length,
      countBefore,
      countAfter,
    });
  } catch (err: any) {
    console.error('Import fout:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
