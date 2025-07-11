// Bestand: src/app/api/rapportage/omzet/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import csv from 'csv-parser';
import { Readable } from 'stream';

// Gebruik nodejs-runtime voor buffer + stream toegang
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows: any[] = [];

    await new Promise((resolve, reject) => {
      Readable.from(buffer.toString())
        .pipe(csv({ separator: ';' }))
        .on('data', (row) => {
          if (!row.datum || !row.tijdstip || !row.product || !row.aantal || !row.verkoopprijs) return;
          const aantal = parseInt(row.aantal);
          const prijs = parseFloat(row.verkoopprijs);
          if (!aantal || !prijs) return;
          rows.push({
            datum: row.datum,
            tijdstip: row.tijdstip,
            product: row.product,
            aantal,
            eenheidsprijs: prijs / aantal
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    for (const r of rows) {
      await db.query(
        `INSERT INTO rapportage.omzet (datum, tijdstip, product, aantal, eenheidsprijs)
         VALUES ($1, $2, $3, $4, $5)`,
        [r.datum, r.tijdstip, r.product, r.aantal, r.eenheidsprijs]
      );
    }

    return NextResponse.json({ success: true, ingevoerd: rows.length });
  } catch (err) {
    console.error('Fout bij CSV-upload:', err);
    return NextResponse.json({ error: 'Verwerking mislukt' }, { status: 500 });
  }
}
