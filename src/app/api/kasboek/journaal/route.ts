import { NextRequest, NextResponse } from 'next/server';
import { query as dbQuery } from '@/lib/db';

// Grootboekmapping: per categorie een code
const GROOTBOEK = {
  verkopen_laag: { code: '8001', oms: 'Omzet (laag tarief)' },
  verkoop_kadobonnen: { code: '8001', oms: 'Omzet (kadobonnen)' },
  prive_opname_herman: { code: '4900', oms: 'Privé opname Herman' },
  prive_opname_erik: { code: '4900', oms: 'Privé opname Erik' },
  ingenomen_kadobon: { code: '8001', oms: 'Ingenomen kadobon' },
  naar_bank_afgestort: { code: '1223', oms: 'Afstorting bank/kruisposten' },
  kasverschil: { code: '9999', oms: 'Kasverschil' },
  wisselgeld_van_bank: { code: '1223', oms: 'Wisselgeld ontvangen van bank' },
  contant_inkoop: { code: '4569', oms: 'Contant betaalde inkoop' },
  // Vul andere categorieën aan indien nodig
};

const BTW_LAAG = 9;

export async function GET(req: NextRequest) {
  const maand = req.nextUrl.searchParams.get('maand'); // bv. "2025-03"
  if (!maand || !/^\d{4}-\d{2}$/.test(maand)) {
    return NextResponse.json({ error: 'Geef ?maand=YYYY-MM mee' }, { status: 400 });
  }

  // Bepaal maandrange
  const maandStart = `${maand}-01`;
  const maandEind = `${maand}-31`; // alle dagen, Postgres is slim

  // Haal alle transacties in de maand op, inclusief kasdag-datum voor robuustheid
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
  let priveOpnames = 0;
  let contantInkoop = 0;
  let afstorting = 0;
  let wisselgeld = 0;

  // Totaal ontvangen (voor kruispost)
  let ontvangsten = 0;

  // Totaal MyPOS (voor kosten, placeholder)
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
      case 'prive_opname_erik':
        priveOpnames += bedrag;
        break;
      case 'kasverschil':
        kasverschil += bedrag;
        break;
      case 'contant_inkoop':
        contantInkoop += bedrag;
        break;
      case 'naar_bank_afgestort':
        afstorting += bedrag;
        break;
      case 'wisselgeld_van_bank':
        wisselgeld += bedrag;
        break;
      // Voeg hier andere gevallen toe als nodig
    }

    // (optioneel) zet hieronder MyPOS-categorieën als je die in je transacties hebt
    if (cat === 'mypos_kosten') {
      myposKosten += bedrag;
    }

    // Alles wat 'ontvangst' is, telt voor ontvangsten/kruispost
    if (t.type === 'ontvangst') {
      ontvangsten += bedrag;
    }
  }

  // Netto omzet voor 9%: omzetLaag + omzetKadobon + ingenomenKadobon
  const brutoOmzet = omzetLaag + omzetKadobon + ingenomenKadobon;
  const nettoOmzet = brutoOmzet / (1 + BTW_LAAG / 100);
  btw9 = brutoOmzet - nettoOmzet;

  regels.push({
    gb: '8001',
    omschrijving: 'Omzet ijs en kadobonnen (excl. BTW)',
    bedrag: Math.round(nettoOmzet * 100) / 100,
  });
  regels.push({
    gb: '0000',
    omschrijving: 'BTW 9% over omzet',
    bedrag: Math.round(btw9 * 100) / 100,
  });

  if (myposKosten !== 0) {
    regels.push({
      gb: '4567',
      omschrijving: 'MyPOS-kosten',
      bedrag: -Math.abs(myposKosten), // kosten altijd negatief
    });
  }
  if (contantInkoop !== 0) {
    regels.push({
      gb: '4569',
      omschrijving: 'Contant betaalde inkoop',
      bedrag: -Math.abs(contantInkoop),
    });
  }
  if (priveOpnames !== 0) {
    regels.push({
      gb: '4900',
      omschrijving: 'Privé-opnames',
      bedrag: -Math.abs(priveOpnames),
    });
  }
  if (kasverschil !== 0) {
    regels.push({
      gb: '9999',
      omschrijving: 'Kasverschil',
      bedrag: kasverschil,
    });
  }
  if (wisselgeld !== 0) {
    regels.push({
      gb: '1223',
      omschrijving: 'Wisselgeld ontvangen',
      bedrag: wisselgeld,
    });
  }
  if (afstorting !== 0) {
    regels.push({
      gb: '1223',
      omschrijving: 'Afstorting bank/kruispost',
      bedrag: afstorting,
    });
  }

  // Eindcontrole: saldo
  const saldo =
    nettoOmzet +
    (afstorting || 0) +
    (wisselgeld || 0) -
    Math.abs(myposKosten) -
    Math.abs(contantInkoop) -
    Math.abs(priveOpnames) +
    kasverschil;

  // Saldo als losse regel
  regels.push({
    gb: '',
    omschrijving: 'Saldo controle (niet boeken)',
    bedrag: Math.round(saldo * 100) / 100,
  });

  return NextResponse.json({
    maand,
    regels,
    toelichting: 'Let op: controleer altijd of de grootboekcodes overeenkomen met je boekhoudpakket.',
  });
}
