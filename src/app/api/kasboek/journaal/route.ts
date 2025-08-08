import { NextRequest, NextResponse } from 'next/server';
import { query as dbQuery } from '@/lib/db';

// Grootboekmapping: per categorie een code
const GROOTBOEK = {
  verkopen_laag: { code: '8001', oms: 'Omzet (laag tarief)' },
  verkoop_kadobonnen: { code: '8003', oms: 'Omzet (kadobonnen)' },
  prive_opname_herman: { code: '620', oms: 'Privé opname Herman' },
  prive_opname_erik: { code: '670', oms: 'Privé opname Erik' },
  ingenomen_kadobon: { code: '8003', oms: 'Ingenomen kadobon' },
  naar_bank_afgestort: { code: '1221', oms: 'Afstorting bank/kruisposten' },
  kasverschil: { code: '8880', oms: 'Kasverschil' },
  wisselgeld_van_bank: { code: '1221', oms: 'Wisselgeld ontvangen van bank' },
};

const BTW_LAAG = 9;

export async function GET(req: NextRequest) {
  const maand = req.nextUrl.searchParams.get('maand');
  if (!maand || !/^\d{4}-\d{2}$/.test(maand)) {
    return NextResponse.json({ error: 'Geef ?maand=YYYY-MM mee' }, { status: 400 });
  }

  // Bepaal maandrange
  const maandStart = `${maand}-01`;
  const [y, m] = maand.split('-').map(Number);
  const maandEind = new Date(y, m, 0).toISOString().slice(0, 10);

  const res = await dbQuery(
    `
    SELECT
      t.*,
      to_char(d.datum::date, 'YYYY-MM-DD') as dagdatum
    FROM kasboek_transacties t
    JOIN kasboek_dagen d ON d.id = t.dag_id
    WHERE d.datum::date >= $1::date AND d.datum::date <= $2::date
    `,
    [maandStart, maandEind]
  );

  let omzetLaag = 0;
  let omzetKadobon = 0;
  let ingenomenKadobon = 0;
  let kasverschil = 0;
  let priveOpnameHerman = 0;
  let priveOpnameErik = 0;
  let afstorting = 0;
  let wisselgeld = 0;
  let myposKosten = 0;

  for (const t of res.rows) {
    const bedrag = Number(t.bedrag || 0);
    const cat = t.categorie;

    switch (cat) {
      case 'verkopen_laag':
        omzetLaag += bedrag;
        break;
      case 'verkoop_kadobonnen':
        omzetKadobon += bedrag;
        break;
      case 'ingenomen_kadobon':
        ingenomenKadobon += bedrag;
        break;
      case 'prive_opname_herman':
        priveOpnameHerman += bedrag;
        break;
      case 'prive_opname_erik':
        priveOpnameErik += bedrag;
        break;
      case 'kasverschil':
        kasverschil += bedrag;
        break;
      case 'naar_bank_afgestort':
        afstorting += bedrag; // meestal negatief in je input!
        break;
      case 'wisselgeld_van_bank':
        wisselgeld += bedrag;
        break;
    }
    if (cat === 'mypos_kosten') {
      myposKosten += bedrag;
    }
  }

  // Omzet exclusief BTW
  const brutoOmzetIjs = omzetLaag;
  const brutoOmzetKado = omzetKadobon + ingenomenKadobon;

  const nettoOmzetIjs = brutoOmzetIjs / (1 + BTW_LAAG / 100);
  const btwOmzetIjs = brutoOmzetIjs - nettoOmzetIjs;

  const nettoOmzetKado = brutoOmzetKado / (1 + BTW_LAAG / 100);
  const btwOmzetKado = brutoOmzetKado - nettoOmzetKado;

  // 1221: Wisselgeld (meestal positief) plus afstorting (meestal negatief!)
  const kruisposten = wisselgeld + afstorting;

  const regels: {
    gb: string;
    omschrijving: string;
    bedrag: number;
    toelichting?: string;
    type?: string;
  }[] = [];

  if (nettoOmzetIjs !== 0) {
    regels.push({
      gb: '8001',
      omschrijving: 'Omzet ijs (excl. BTW)',
      bedrag: Math.round(nettoOmzetIjs * 100) / 100,
    });
    regels.push({
      gb: '0000',
      omschrijving: 'BTW 9% over omzet ijs',
      bedrag: Math.round(btwOmzetIjs * 100) / 100,
    });
  }
  if (nettoOmzetKado !== 0) {
    regels.push({
      gb: '8003',
      omschrijving: 'Omzet kadobonnen (excl. BTW, incl. ingenomen)',
      bedrag: Math.round(nettoOmzetKado * 100) / 100,
    });
    regels.push({
      gb: '0000',
      omschrijving: 'BTW 9% over kadobonnen',
      bedrag: Math.round(btwOmzetKado * 100) / 100,
    });
  }
  if (myposKosten !== 0) {
    regels.push({
      gb: '4567',
      omschrijving: 'MyPOS-kosten',
      bedrag: -Math.abs(myposKosten),
    });
  }
  if (priveOpnameHerman !== 0) {
    regels.push({
      gb: '620',
      omschrijving: 'Privé-opname Herman',
      bedrag: -Math.abs(priveOpnameHerman),
    });
  }
  if (priveOpnameErik !== 0) {
    regels.push({
      gb: '670',
      omschrijving: 'Privé-opname Erik',
      bedrag: -Math.abs(priveOpnameErik),
    });
  }
  if (kasverschil !== 0) {
    regels.push({
      gb: '8880',
      omschrijving: 'Kasverschil',
      bedrag: kasverschil,
    });
  }
  if (kruisposten !== 0) {
    regels.push({
      gb: '1221',
      omschrijving: 'Kruisposten wisselgeld + afstorting',
      bedrag: kruisposten,
    });
  }

  regels.push({
    gb: '',
    omschrijving: 'Saldo controle (niet boeken)',
    bedrag: 0, // saldo fixen we evt. straks
  });

  return NextResponse.json({
    maand,
    regels,
    toelichting: 'Controleer altijd de grootboekcodes vóór boeking.',
  });
}
