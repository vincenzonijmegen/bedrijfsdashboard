// Bestand: src/app/api/rapportage/omzet/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import xlsx from 'xlsx';

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
  const parts = waarde.split('-');
  if (parts.length !== 3) return null;
  const [dag, maand, jaarRaw] = parts;
  let jaar = jaarRaw;
  if (jaar.length === 2) jaar = '20' + jaar;
  const datumISO = `${jaar}-${maand.padStart(2, '0')}-${dag.padStart(2, '0')}`;
  return isNaN(Date.parse(datumISO)) ? null : datumISO;
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') return NextResponse.json({ error: 'Ongeldig bestand' }, { status: 400 });
    const stream = (file as any).stream();
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    const rows: any[] = [];
    for (const rij of rawData) {
      // cel1 datum, cel2 tijd, cel3 betaalwijze, cel4 aantal, cel5 totaalbedrag
      if (rij.length < 5) continue;
      const [datum, tijd, _betaal, aantal, totaal] = rij;
      const d = parseDatumNL(datum.toString());
      if (!d) return NextResponse.json({ error: `Ongeldige datum: ${datum}` }, { status: 400 });
      const t = tijdString(tijd.toString());
      const count = parseInt(aantal);
      const sum = parseFloat(totaal.toString().replace(',', '.'));
      if (isNaN(count) || isNaN(sum)) continue;
      rows.push({ datum: d, tijdstip: t, product: 'Onbekend', aantal: count, eenheidsprijs: sum / count });
    }

    // Check op bestaande datums
    const unieke = [...new Set(rows.map(r => r.datum))];
    const exists = await db.query(
      'SELECT COUNT(*) FROM rapportage.omzet WHERE datum = ANY($1::date[])', [unieke]
    );
    if (parseInt(exists.rows[0].count) > 0) {
      return NextResponse.json({ error: 'Datum bestaat al, import geannuleerd' }, { status: 400 });
    }

    // Batch insert
    const batchSize = 1000;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const vals = batch.map((_, idx) =>
        `($${idx*5+1},$${idx*5+2},$${idx*5+3},$${idx*5+4},$${idx*5+5})`
      ).join(',');
      const flat = batch.flatMap(r => [r.datum, r.tijdstip, r.product, r.aantal, r.eenheidsprijs]);
      await db.query(
        `INSERT INTO rapportage.omzet (datum,tijdstip,product,aantal,eenheidsprijs) VALUES ${vals}`, flat
      );
    }
    return NextResponse.json({ success: true, ingevoerd: rows.length });
  } catch (err: any) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
