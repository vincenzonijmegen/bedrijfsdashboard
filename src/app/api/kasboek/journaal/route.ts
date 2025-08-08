import { NextRequest, NextResponse } from 'next/server';
import { query as dbQuery } from '@/lib/db';

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

  const maandStart = `${maand}-01`;
  const [y, m] = maand.split('-').map(Number);
  const maandEind = new Date(y, m, 0).toISOString().slice(0, 10);

  // Transacties ophalen
  const res = await dbQuery(
    `
    SELECT t.*, to_char(d.datum::date, 'YYYY-MM-DD') as dagdatum
    FROM kasboek_transacties t
    JOIN kasboek_dagen d ON d.id = t.dag_id
    WHERE d.datum::date >= $1::date AND d.datum::date <= $2::date
    `,
    [maandStart, maandEind]
  );

  // Kasdaggegevens ophalen voor saldo
  const dagen = await dbQuery(
    `
    SELECT
      to_char(datum::date, 'YYYY-MM-DD') as datum,
      startbedrag::numeric,
      eindsaldo::numeric
    FROM kasboek_dagen
    WHERE datum::date >= $1::date AND datum::date <= $2::date
    ORDER BY datum
    `,
    [maandStart, maandEind]
  );

  // Begin/eindsaldo bepalen
  const eersteDag = dagen.rows[0];
  const laatsteDag = dagen.rows[dagen.rows.length - 1];
  const beginsaldo = eersteDag?.startbedrag ?? 0;
  const eindsaldo = laatsteDag?.eindsaldo ?? 0;

  // Boekingsregels verzamelen
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
      case 'verkopen_laag': omzetLaag += bedrag; break;
      case 'verkoop_kadobonnen': omzetKadobon += bedrag; break;
      case 'ingenomen_kadobon': ingenomenKadobon += bedrag; break;
      case 'prive_opname_herman': priveOpnameHerman += bedrag; break;
      case 'prive_opname_erik': priveOpnameErik += bedrag; break;
      case 'kasverschil': kasverschil += bedrag; break;
      case 'naar_bank_afgestort': afstorting += bedrag; break; // meestal negatief in input!
      case 'wisselgeld_van_bank': wisselgeld += bedrag; break;
    }
    if (cat === 'mypos_kosten') {
      myposKosten += bedrag;
    }
  }

  // Kadobonnen: verkoop = positief, ingenomen = negatief
  const kadobonnen = omzetKadobon - ingenomenKadobon;

  // Bruto totaalomzet = ijs + kadobonnen
  const brutoOmzet = omzetLaag + kadobonnen;
  const nettoOmzet = brutoOmzet / (1 + BTW_LAAG / 100);
  const btwTotaal = brutoOmzet - nettoOmzet;

  // Voor de regels: splits netto omzet ijs en kadobonnen apart, maar BTW alleen totaal
  const nettoOmzetIjs = omzetLaag / (1 + BTW_LAAG / 100);
  const nettoOmzetKado = kadobonnen / (1 + BTW_LAAG / 100);

  const regels: { gb: string; omschrijving: string; bedrag: number }[] = [];

  // 8001: netto omzet ijs (alleen als niet nul)
  if (nettoOmzetIjs !== 0) {
    regels.push({
      gb: '8001',
      omschrijving: 'Omzet ijs (excl. BTW)',
      bedrag: Math.round(nettoOmzetIjs * 100) / 100,
    });
  }
  // 8003: netto kadobonnen
  if (nettoOmzetKado !== 0) {
    regels.push({
      gb: '8003',
      omschrijving: 'Kadobonnen: verkoop - ingenomen (excl. BTW)',
      bedrag: Math.round(nettoOmzetKado * 100) / 100,
    });
  }
  // 0000: één totaalregel BTW over alles
  if (btwTotaal !== 0) {
    regels.push({
      gb: '0000',
      omschrijving: 'BTW 9% over totale omzet',
      bedrag: Math.round(btwTotaal * 100) / 100,
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

  // Kruisposten: wisselgeld + abs(afstorting)
  const kruisposten = wisselgeld - afstorting;
  if (kruisposten !== 0) {
    regels.push({
      gb: '1221',
      omschrijving: 'Kruisposten wisselgeld',
      bedrag: kruisposten,
    });
  }

  // Saldo-controle = eindsaldo laatste dag - beginsaldo eerste dag
  regels.push({
    gb: '',
    omschrijving: 'Saldo controle (niet boeken)',
    bedrag: Math.round((eindsaldo - beginsaldo) * 100) / 100,
  });

  return NextResponse.json({
    maand,
    regels,
    beginsaldo,
    eindsaldo,
    toelichting: 'Controleer altijd de grootboekcodes vóór boeking.',
  });
}
