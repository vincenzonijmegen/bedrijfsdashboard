// Bestand: src/app/api/rapportage/omzet/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Readable } from 'stream';
import * as csv from 'csv-parse';

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

    // Eerst unieke datums verzamelen
    const tijdelijkeDatums: string[] = [];
    await new Promise((resolve, reject) => {
      Readable.from(buffer)
        .pipe(csv.parse({ delimiter: ';', fromLine: 1, columns: false }))
        .on('data', (cols: string[]) => {
          const datum = cols[0]?.trim();
          if (parseDatumNL(datum)) tijdelijkeDatums.push(datum);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const uniekeDatums = [...new Set(tijdelijkeDatums)];
    const result = await db.query(
      'SELECT DISTINCT datum FROM rapportage.omzet WHERE datum = ANY($1::date[])', [uniekeDatums]
    );
    const bestaande = result.rows.map(r => r.datum.toISOString().slice(0, 10));

    const rows: any[] = [];
    await new Promise((resolve, reject) => {
      Readable.from(buffer)
        .pipe(csv.parse({ delimiter: ';', fromLine: 1 }))
        .on('data', (cols: string[]) => {
          const [datum, tijdstip, , product, aantalStr, prijsStr] = cols;
          if (!datum || bestaande.includes(datum)) return;

          const tijd = tijdString(tijdstip?.trim());
          const aantal = parseInt(aantalStr);
          const prijs = parseFloat(prijsStr?.replace(',', '.') || '');

          if (!aantal || !prijs || !parseDatumNL(datum)) return;

          rows.push({
            datum: parseDatumNL(datum),
            tijdstip: tijd,
            product: product?.trim() || 'Onbekend',
            aantal,
            eenheidsprijs: prijs / aantal
          });
        })
        .on('end', resolve)
        .on('error', reject);
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
