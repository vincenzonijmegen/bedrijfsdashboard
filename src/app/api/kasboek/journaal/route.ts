import { NextRequest, NextResponse } from 'next/server';
import { query as dbQuery } from '@/lib/db';

const BTW_LAAG = 9;

const rondAf = (waarde: number) => Math.round(waarde * 100) / 100;

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

  const eersteDag = dagen.rows[0];
  const laatsteDag = dagen.rows[dagen.rows.length - 1];
  const beginsaldo = eersteDag?.startbedrag ?? 0;
  const eindsaldo = laatsteDag?.eindsaldo ?? 0;

  // Boekingsregels verzamelen
  let omzetLaag = 0;
  let verkoopKadobonnen = 0;
  let ingenomenKadobon = 0;
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
      case 'verkoop_kadobonnen':
        verkoopKadobonnen += bedrag;
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
  */

  // Bruto omzet waar 9% btw uit gehaald moet worden:
  // gewone kasomzet + ingenomen cadeaubonnen.
  // Verkochte cadeaubonnen zitten hier bewust NIET in.
  const brutoOmzet = omzetLaag + ingenomenKadobon;
  const nettoOmzet = brutoOmzet / (1 + BTW_LAAG / 100);
  const btwTotaal = brutoOmzet - nettoOmzet;

  const nettoOmzetIjs = omzetLaag / (1 + BTW_LAAG / 100);
  const nettoOmzetKadobonnenIngenomen = ingenomenKadobon / (1 + BTW_LAAG / 100);

  const regels: { gb: string; omschrijving: string; bedrag: number }[] = [];

  // 8001: netto omzet ijs
  if (nettoOmzetIjs !== 0) {
    regels.push({
      gb: '8001',
      omschrijving: 'Omzet ijs (excl. BTW)',
      bedrag: rondAf(nettoOmzetIjs),
    });
  }

  // 8003: omzet bij inlevering cadeaubonnen
  if (nettoOmzetKadobonnenIngenomen !== 0) {
    regels.push({
      gb: '8003',
      omschrijving: 'Kadobonnen ingenomen (excl. BTW)',
      bedrag: rondAf(nettoOmzetKadobonnenIngenomen),
    });
  }

  // 2215: verkochte cadeaubonnen = verplichting omhoog
  if (verkoopKadobonnen !== 0) {
    regels.push({
      gb: '2215',
      omschrijving: 'Tussenrekening cadeaubonnen - verkocht',
      bedrag: rondAf(verkoopKadobonnen),
    });
  }

  // 2215: ingenomen cadeaubonnen = verplichting omlaag / vrijval
  if (ingenomenKadobon !== 0) {
    regels.push({
      gb: '2215',
      omschrijving: 'Tussenrekening cadeaubonnen - ingenomen',
      bedrag: -rondAf(ingenomenKadobon),
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
      bedrag: -kasverschil, // Teken omgedraaid
    });
  }

  // Kruisposten: wisselgeld - afstorting
  const kruisposten = wisselgeld - afstorting;

  if (kruisposten !== 0) {
    regels.push({
      gb: '1221',
      omschrijving: 'Kruisposten wisselgeld',
      bedrag: rondAf(kruisposten),
    });
  }

  // BTW-regel als laatste en markeer als italic in frontend
  if (btwTotaal !== 0) {
    regels.push({
      gb: '0000',
      omschrijving: 'BTW 9% over omzet',
      bedrag: rondAf(btwTotaal),
    });
  }

  // Saldo-controle = som van de regels, niet boeken
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