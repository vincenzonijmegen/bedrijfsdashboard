// Bestand: src/app/api/rapportage/omzet/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import csv from 'csv-parser';
import { Readable } from 'stream';

export const runtime = 'nodejs';

export const config = {
  api: {
    bodyParser: false,
  },
  maxSize: '100mb',
};

const tijdString = (waarde: string) => {
  if (waarde.includes(':')) return waarde;
  const getal = parseFloat(waarde.replace(',', '.'));
  if (isNaN(getal)) return '00:00:00';
  const totaalSeconden = Math.round(getal * 24 * 60 * 60);
  const uren = Math.floor(totaalSeconden / 3600).toString().padStart(2, '0');
  const minuten = Math.floor((totaalSeconden % 3600) / 60).toString().padStart(2, '0');
  const seconden = (totaalSeconden % 60).toString().padStart(2, '0');
  return `${uren}:${minuten}:${seconden}`;
};


export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows: any[] = [];

    const parseDatumNL = (waarde: string) => {
  const parts = waarde.split('-');
  if (parts.length !== 3) return null;
  let [dag, maand, jaar] = parts;
  if (jaar.length === 2) jaar = '20' + jaar;
  const datumISO = `${jaar}-${maand.padStart(2, '0')}-${dag.padStart(2, '0')}`;
  return isNaN(Date.parse(datumISO)) ? null : datumISO;
};

    await new Promise((resolve, reject) => {
      Readable.from(buffer.toString())
        .pipe(csv({ separator: ';', mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').toLowerCase() }))
        .on('data', (row) => {
          console.log('Gelezen rij:', row);
          if (!row.datum || !row.tijdstip || !row.product || !row.aantal || !row.verkoopprijs) return;
          const aantal = parseInt(row.aantal);
          const prijs = parseFloat(row.verkoopprijs);
          if (!aantal || !prijs) return;
          const omgezetteDatum = parseDatumNL(row.datum);
          if (!omgezetteDatum) return;
          rows.push({
            datum: omgezetteDatum,
            tijdstip: tijdString(row.tijdstip),
            product: row.product,
            aantal,
            eenheidsprijs: prijs / aantal
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Batch insert per 1000 regels
    const batchSize = 1000;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values = batch.map(
        (_, idx) => `($${idx * 5 + 1}, $${idx * 5 + 2}, $${idx * 5 + 3}, $${idx * 5 + 4}, $${idx * 5 + 5})`
      ).join(', ');

      const flatValues = batch.flatMap(r => [r.datum, r.tijdstip, r.product, r.aantal, r.eenheidsprijs]);

      await db.query(
        `INSERT INTO rapportage.omzet (datum, tijdstip, product, aantal, eenheidsprijs) VALUES ${values}`,
        flatValues
      );
    }

    return NextResponse.json({ success: true, ingevoerd: rows.length });
  } catch (err) {
    console.error('Fout bij CSV-upload:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
