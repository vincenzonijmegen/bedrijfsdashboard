// @ts-nocheck
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const grootboekMapping = {
  verkopen_laag:         { gb: '8001', omschrijving: 'Verkopen laag',         btw: '9%' },
  verkoop_kadobonnen:    { gb: '8003', omschrijving: 'Verkoop kadobonnen',    btw: '9%' },
  wisselgeld_van_bank:   { gb: '1221', omschrijving: 'Wisselgeld van bank',   btw: 'geen' },
  prive_opname_herman:   { gb: '620',  omschrijving: 'Privé opname Herman',   btw: 'geen' },
  prive_opname_erik:     { gb: '670',  omschrijving: 'Privé opname Erik',     btw: 'geen' },
  ingenomen_kadobon:     { gb: '8003', omschrijving: 'Ingenomen kadobonnen',  btw: '9%' },
  contant_inkoop:        { gb: null,   omschrijving: '',                      btw: 'geen' },
  naar_bank_afgestort:   { gb: '1221', omschrijving: 'Afstorting naar bank',  btw: 'geen' },
  kasverschil:           { gb: '8880', omschrijving: 'Kasverschil',           btw: 'geen' },
};

export async function GET(_, { params }) {
  const maand = params.maand;

  const { rows } = await db.query(`
    SELECT categorie, type, bedrag, btw
    FROM kasboek_transacties
    WHERE dag_id IN (
      SELECT id FROM kasboek_dagen WHERE TO_CHAR(datum, 'YYYY-MM') = $1
    )
  `, [maand]);

  const samenvatting = {};
  let totaalBTW = 0;

  for (const tx of rows) {
    const map = grootboekMapping[tx.categorie];
    if (!map || !map.gb) continue;

    const gb = map.gb;
    const key = gb + '|' + map.omschrijving;
    const isBTW = map.btw === '9%' && tx.btw === '9%';

    const netto = isBTW ? Number(tx.bedrag) / 1.09 : Number(tx.bedrag);
    const btwBedrag = isBTW ? Number(tx.bedrag) - netto : 0;

    samenvatting[key] = (samenvatting[key] || 0) + netto;
    totaalBTW += btwBedrag;
  }

  const resultaat = Object.entries(samenvatting).map(([key, bedrag]) => {
    const [grootboek, omschrijving] = key.split('|');
    return {
      grootboek,
      omschrijving,
      bedrag: Math.round(bedrag * 100) / 100
    };
  });

  if (totaalBTW > 0) {
    resultaat.push({
      grootboek: '0000',
      omschrijving: 'BTW af te dragen',
      bedrag: Math.round(totaalBTW * 100) / 100
    });
  }

  return NextResponse.json(resultaat);
}
