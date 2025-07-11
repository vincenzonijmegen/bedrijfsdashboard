// Bestand: src/app/api/rapportage/omzet/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import xlsx from 'xlsx';

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

const parseDatum = (excelDatum: Date | string) => {
  if (typeof excelDatum === 'string') return excelDatum;
  return excelDatum.toISOString().split('T')[0];
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    const rows: any[] = [];

    for (const rij of rawData as any[]) {
      if (rij.length < 5) continue;
      const [datum, tijd, _betaalwijze, aantal, totaal] = rij;
      const parsedDatum = parseDatum(datum);
      const tijdstip = tijdString(tijd.toString());
      const parsedAantal = parseInt(aantal);
      const parsedTotaal = parseFloat(totaal);
      if (!parsedDatum || isNaN(parsedAantal) || isNaN(parsedTotaal)) continue;
      rows.push({
        datum: parsedDatum,
        tijdstip,
        product: 'Onbekend',
        aantal: parsedAantal,
        eenheidsprijs: parsedTotaal / parsedAantal
      });
    }

    const uniekeDatums = [...new Set(rows.map(r => r.datum))];
    const result = await db.query(
      `SELECT COUNT(*) FROM rapportage.omzet WHERE datum = ANY($1::date[])`,
      [uniekeDatums]
    );
    if (parseInt(result.rows[0].count) > 0) {
      return NextResponse.json({ error: 'Er bestaan al regels met deze datum. Bestand geweigerd.' }, { status: 400 });
    }

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
    console.error('Fout bij upload:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
