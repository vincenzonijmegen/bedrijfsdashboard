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
  // Contant_inkoop wordt niet meer meegenomen
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
  const maandEind = new Date(y, m, 0).toISOString().slice(0, 10); // 'YYYY-MM-DD'

  // Haal alle transacties in de maand op
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

  const regels: {
    gb: string;
    omschrijving: string;
    bedrag: number;
    toelichting?: string;
    type?: string;
  }[] = [];

  let omzetLaag = 0;
  let omzetKadobon = 0;
  let ingenomenKadobon = 0;
  let kasverschil = 0;
  let priveOpnameHerman = 0;
  let priveOpnameErik = 0;
  let afstorting = 0;
  let wisselgeld = 0;
  // let contantInkoop = 0; // Wordt niet meer meegenomen

  let myposKosten = 0;
  let btw9 = 0;

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
      // case 'contant_inkoop':
      //   contantInkoop += bedrag;
      //   break;
      case 'naar_bank_afgestort':
        afstorting += bedrag;
        break;
      case 'wisselgeld_van_bank':
        wisselgeld += bedrag;
        break;
    }
    if (cat === 'mypos_kosten') {
      myposKosten += bedrag;
    }
  }

  // Netto omzet voor 9%: omzetLaag + omzetKadobon + ingenomenKadobon
  const brutoOmzet = omzetLaag + omzetKadobon + ingenomenKadobon;
  const nettoOmzet = brutoOmzet / (1 + BTW_LAAG / 100);
  btw9 = brutoOmzet - nettoOmzet;

  regels.push({
    gb: '8001',
    omschrijving: 'Omzet ijs (excl. BTW)',
    bedrag: Math.round(nettoOmzet * 100) / 100,
  });
  regels.push({
    gb: '0000',
    omschrijving: 'BTW 9% over omzet',
    bedrag: Math.round(btw9 * 100) / 100,
  });

  if (omzetKadobon !== 0 || ingenomenKadobon !== 0) {
    regels.push({
      gb: '8003',
      omschrijving: 'Kadobonnen omzet en ingenomen',
      bedrag: Math.round((omzetKadobon + ingenomenKadobon) * 100) / 100,
    });
  }
  if (myposKosten !== 0) {
    regels.push({
      gb: '4567',
      omschrijving: 'MyPOS-kosten',
      bedrag: -Math.abs(myposKosten),
    });
  }

  // Prive-opnames per persoon, apart
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

  // Wisselgeld + afstorting samen als één kruispost-regel
  const kruisposten = wisselgeld + afstorting;
  if (kruisposten !== 0) {
    regels.push({
      gb: '1221',
      omschrijving: 'Kruisposten wisselgeld + afstorting',
      bedrag: kruisposten,
    });
  }

  // Saldo-controle komt straks, kan hieronder blijven als referentie
  regels.push({
    gb: '',
    omschrijving: 'Saldo controle (niet boeken)',
    bedrag: 0, // later afmaken
  });

  return NextResponse.json({
    maand,
    regels,
    toelichting: 'Controleer altijd de grootboekcodes vóór boeking.',
  });
}
