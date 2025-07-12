// Bestand: src/app/api/rapportage/omzet/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import csv from 'csv-parser';
import { Readable } from 'stream';

export const runtime = 'nodejs';
export const config = {
  api: { bodyParser: false },
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

const parseDatumNL = (waarde: string) => {
  if (!waarde || typeof waarde !== 'string') return null;
  const isoMatch = /^\d{4}-\d{2}-\d{2}$/.test(waarde);
  if (!isoMatch || isNaN(Date.parse(waarde))) return null;
  return waarde;
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Geen geldig bestand ontvangen' }, { status: 400 });
    }

    const arrayBuffer = await (file as unknown as Blob).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const testRows: any[] = [];

    // Eerst 20 regels uitlezen om unieke datums te verzamelen vóór parsen
    await new Promise((resolve, reject) => {
      let regelTeller = 0;
      Readable.from(buffer)
        .pipe(csv({ separator: ';', mapHeaders: ({ header }) => header.trim().toLowerCase() }))
        .on('data', (row) => {
          if (regelTeller >= 50) return;
          regelTeller++;
          const datum = parseDatumNL(row.datum);
          if (datum) testRows.push(datum);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const unieke = [...new Set(testRows)];
    const exists = await db.query(
      'SELECT COUNT(*) FROM rapportage.omzet WHERE datum = ANY($1::date[])', [unieke]
    );
    if (parseInt(exists.rows[0].count) > 0) {
      return NextResponse.json({ error: 'Datum bestaat al, import geannuleerd' }, { status: 400 });
    }

    const rows: any[] = [];
    await new Promise((resolve, reject) => {
      let regelTeller = 0;
      Readable.from(buffer)
        .pipe(csv({ separator: ';', mapHeaders: ({ header }) => header.trim().toLowerCase() }))
        .on('data', (row) => {
          regelTeller++;
          console.log(`Rij ${regelTeller}:`, row);

          if (!row.datum || typeof row.datum !== 'string') {
            console.log(`❌ Rij ${regelTeller} overgeslagen: geen geldige datum.`);
            return;
          }
          const datum = parseDatumNL(row.datum);
          if (!datum) {
            console.log(`❌ Rij ${regelTeller} overgeslagen: datum ${row.datum} ongeldig.`);
            return;
          }
          const tijd = tijdString(row.tijdstip);
          const aantal = parseInt(row.aantal);
          const prijs = parseFloat(row.verkoopprijs?.toString().replace(',', '.') || '');

          if (!aantal || !prijs) {
            console.log(`❌ Rij ${regelTeller} overgeslagen: ongeldige aantal/prijs.`);
            return;
          }

          rows.push({
            datum,
            tijdstip: tijd,
            product: row.product || 'Onbekend',
            aantal,
            eenheidsprijs: prijs / aantal
          });
        })
        .on('end', () => {
          console.log(`✅ Parser klaar. ${rows.length} geldige rijen verzameld.`);
          resolve(null);
        })
        .on('error', (err) => {
          console.error('❌ CSV-parser fout:', err);
          reject(err);
        });
    });

    const batchSize = 1000;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values = batch.map((_, idx) => `($${idx * 5 + 1}, $${idx * 5 + 2}, $${idx * 5 + 3}, $${idx * 5 + 4}, $${idx * 5 + 5})`).join(', ');
      const flatValues = batch.flatMap(r => [r.datum, r.tijdstip, r.product, r.aantal, r.eenheidsprijs]);
      await db.query(
        `INSERT INTO rapportage.omzet (datum, tijdstip, product, aantal, eenheidsprijs) VALUES ${values}`,
        flatValues
      );
    }

    return NextResponse.json({ success: true, ingevoerd: rows.length });
  } catch (err: any) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
