import { NextRequest, NextResponse } from 'next/server';
import { query as dbQuery } from '@/lib/db';

const BTW_LAAG = 9;
const BTW_HOOG = 21;

const rondAf = (waarde: number) => Math.round(waarde * 100) / 100;

const nettoUitBruto = (bruto: number, btwPercentage: number) =>
  bruto / (1 + btwPercentage / 100);

export async function GET(req: NextRequest) {
  const maand = req.nextUrl.searchParams.get('maand');

  if (!maand || !/^\d{4}-\d{2}$/.test(maand)) {
    return NextResponse.json(
      { error: 'Geef ?maand=YYYY-MM mee' },
      { status: 400 }
    );
  }

  const maandStart = `${maand}-01`;
  const [y, m] = maand.split('-').map(Number);
  const maandEind = new Date(y, m, 0).toISOString().slice(0, 10);

  const res = await dbQuery(
    `
    SELECT t.*, to_char(d.datum::date, 'YYYY-MM-DD') as dagdatum
    FROM kasboek_transacties t
    JOIN kasboek_dagen d ON d.id = t.dag_id
    WHERE d.datum::date >= $1::date AND d.datum::date <= $2::date
    `,
    [maandStart, maandEind]
  );

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

  const eersteDag = dagen.rows[0];
  const laatsteDag = dagen.rows[dagen.rows.length - 1];
  const beginsaldo = eersteDag?.startbedrag ?? 0;
  const eindsaldo = laatsteDag?.eindsaldo ?? 0;

  let omzetLaag = 0;
  let omzetHoog = 0;

  let verkoopKadobonnen = 0;

  let ingenomenKadobonLaag = 0;
  let ingenomenKadobonHoog = 0;

  let kasverschil = 0;
  let priveOpnameHerman = 0;
  let priveOpnameErik = 0;
  let afstorting = 0;
  let wisselgeld = 0;
  let myposKosten = 0;

  for (const t of res.rows) {
    const bedrag = Number(t.bedrag || 0);
    const cat = String(t.categorie);

    switch (cat) {
      case 'verkopen_laag':
        omzetLaag += bedrag;
        break;

      case 'verkopen_hoog':
        omzetHoog += bedrag;
        break;

      case 'verkoop_kadobonnen':
        verkoopKadobonnen += bedrag;
        break;

      case 'ingenomen_kadobon':
        ingenomenKadobonLaag += bedrag;
        break;

      case 'ingenomen_kadobon_hoog':
        ingenomenKadobonHoog += bedrag;
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
        afstorting += bedrag;
        break;

      case 'wisselgeld_van_bank':
        wisselgeld += bedrag;
        break;

      case 'mypos_kosten':
        myposKosten += bedrag;
        break;
    }
  }

  /*
    MPV-logica cadeaubonnen:

    Verkochte cadeaubonnen:
    - geen omzet
    - geen btw
    - wel opbouw verplichting op 2215

    Ingenomen cadeaubonnen:
    - omzet ontstaat bij inlevering
    - btw ontstaat bij inlevering
    - verplichting op 2215 valt vrij

    Voor 21%-artikelen zoals merchandise moet de inlevering apart kunnen worden geboekt.
  */

  const brutoLaag = omzetLaag + ingenomenKadobonLaag;
  const brutoHoog = omzetHoog + ingenomenKadobonHoog;

  const nettoOmzetLaag = nettoUitBruto(omzetLaag, BTW_LAAG);
  const nettoOmzetHoog = nettoUitBruto(omzetHoog, BTW_HOOG);

  const nettoKadobonnenIngenomenLaag = nettoUitBruto(
    ingenomenKadobonLaag,
    BTW_LAAG
  );

  const nettoKadobonnenIngenomenHoog = nettoUitBruto(
    ingenomenKadobonHoog,
    BTW_HOOG
  );

  const nettoTotaalLaag = nettoUitBruto(brutoLaag, BTW_LAAG);
  const btwLaag = brutoLaag - nettoTotaalLaag;

  const nettoTotaalHoog = nettoUitBruto(brutoHoog, BTW_HOOG);
  const btwHoog = brutoHoog - nettoTotaalHoog;

  const regels: { gb: string; omschrijving: string; bedrag: number }[] = [];

  if (nettoOmzetLaag !== 0) {
    regels.push({
      gb: '8001',
      omschrijving: 'Omzet laag 9% (excl. BTW)',
      bedrag: rondAf(nettoOmzetLaag),
    });
  }

  if (nettoOmzetHoog !== 0) {
    regels.push({
      gb: '8002',
      omschrijving: 'Omzet hoog 21% (excl. BTW)',
      bedrag: rondAf(nettoOmzetHoog),
    });
  }

  if (nettoKadobonnenIngenomenLaag !== 0) {
    regels.push({
      gb: '8003',
      omschrijving: 'Kadobonnen ingenomen 9% (excl. BTW)',
      bedrag: rondAf(nettoKadobonnenIngenomenLaag),
    });
  }

  if (nettoKadobonnenIngenomenHoog !== 0) {
    regels.push({
      gb: '8004',
      omschrijving: 'Kadobonnen ingenomen 21% (excl. BTW)',
      bedrag: rondAf(nettoKadobonnenIngenomenHoog),
    });
  }

  if (verkoopKadobonnen !== 0) {
    regels.push({
      gb: '2215',
      omschrijving: 'Tussenrekening cadeaubonnen - verkocht',
      bedrag: rondAf(verkoopKadobonnen),
    });
  }

  const totaalIngenomenKadobonnen =
    ingenomenKadobonLaag + ingenomenKadobonHoog;

  if (totaalIngenomenKadobonnen !== 0) {
    regels.push({
      gb: '2215',
      omschrijving: 'Tussenrekening cadeaubonnen - ingenomen',
      bedrag: -rondAf(totaalIngenomenKadobonnen),
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
      bedrag: -kasverschil,
    });
  }

  const kruisposten = wisselgeld - afstorting;

  if (kruisposten !== 0) {
    regels.push({
      gb: '1221',
      omschrijving: 'Kruisposten wisselgeld',
      bedrag: rondAf(kruisposten),
    });
  }

  if (btwLaag !== 0) {
    regels.push({
      gb: '0000',
      omschrijving: 'BTW 9% over omzet',
      bedrag: rondAf(btwLaag),
    });
  }

  if (btwHoog !== 0) {
    regels.push({
      gb: '0000',
      omschrijving: 'BTW 21% over omzet',
      bedrag: rondAf(btwHoog),
    });
  }

  const saldocontrole = regels.reduce((t, regel) => t + regel.bedrag, 0);

  regels.push({
    gb: '',
    omschrijving: 'Saldo controle (niet boeken)',
    bedrag: rondAf(saldocontrole),
  });

  return NextResponse.json({
    maand,
    regels,
    beginsaldo,
    eindsaldo,
    toelichting: 'Controleer altijd de grootboekcodes vóór boeking.',
  });
}