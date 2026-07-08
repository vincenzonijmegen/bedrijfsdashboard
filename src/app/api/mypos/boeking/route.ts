import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BTW_LAAG = 9;

const rondAf = (waarde: number) => Math.round(waarde * 100) / 100;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const maand = searchParams.get("maand"); // formaat: YYYY-MM

  if (!maand || !/^\d{4}-\d{2}$/.test(maand)) {
    return NextResponse.json(
      { error: "Ongeldige maandparameter. Gebruik formaat YYYY-MM." },
      { status: 400 }
    );
  }

  const beginDatum = `${maand}-01`;

  // Haal alle MyPOS-transacties op voor deze maand
  let transacties;

  try {
    const result = await db.query(
      `
      SELECT ledger_account, amount
      FROM mypos_transactions
      WHERE DATE_TRUNC('month', value_date) = DATE_TRUNC('month', $1::date)
      `,
      [beginDatum]
    );

    transacties = result.rows;
  } catch (err) {
    return NextResponse.json(
      { error: "Fout bij ophalen transacties: " + String(err) },
      { status: 500 }
    );
  }

  // Sommeer MyPOS-bedragen per grootboekrekening
  const totalen: Record<string, number> = {};

  for (const tx of transacties) {
    const rekening = tx.ledger_account;
    const bedrag = parseFloat(tx.amount);

    if (!rekening || Number.isNaN(bedrag)) continue;

    totalen[rekening] = (totalen[rekening] ?? 0) + bedrag;
  }

  /*
    Verkochte cadeaubonnen uit het kasboek.

    Deze worden boekhoudkundig niet als omzet behandeld.
    Ze worden bruto van de MyPOS-ontvangsten afgehaald voordat btw wordt berekend.

    Belangrijk:
    Als MyPOS nog niet is geïmporteerd, mogen we hierdoor geen negatieve omzet/btw maken.
  */
  let verkochteCadeaubonnen = 0;

  try {
    const bonnenResult = await db.query(
      `
      SELECT COALESCE(SUM(t.bedrag), 0)::numeric AS totaal
      FROM kasboek_transacties t
      JOIN kasboek_dagen d ON d.id = t.dag_id
      WHERE DATE_TRUNC('month', d.datum::date) = DATE_TRUNC('month', $1::date)
        AND t.categorie::text = 'verkoop_kadobonnen'
      `,
      [beginDatum]
    );

    verkochteCadeaubonnen = Number(bonnenResult.rows[0]?.totaal ?? 0);
  } catch (err) {
    return NextResponse.json(
      { error: "Fout bij ophalen verkochte cadeaubonnen: " + String(err) },
      { status: 500 }
    );
  }

  const brutoMyposOntvangsten = totalen["8001"] ?? 0;

  /*
    Geen MyPOS-omzet geïmporteerd:
    dan ook geen omzet/btw berekenen.
    Anders ontstaat er onterecht negatieve omzet en negatieve btw
    door alvast verkochte cadeaubonnen af te trekken van 0.
  */
  if (brutoMyposOntvangsten === 0) {
    return NextResponse.json({
      maand,
      regels: [],
      saldo: 0,
      melding:
        "Geen MyPOS-omzet geïmporteerd voor deze maand. Verkochte cadeaubonnen worden pas verwerkt zodra de MyPOS-omzet aanwezig is.",
      controle: {
        brutoMyposOntvangsten: 0,
        verkochteCadeaubonnen: rondAf(verkochteCadeaubonnen),
        brutoOmzetNaCorrectie: 0,
      },
    });
  }

  /*
    Correcte volgorde:
    1. Bruto MyPOS-ontvangsten
    2. Min bruto verkochte cadeaubonnen
    3. Daarna pas btw uit het restant halen
  */
  const brutoOmzet = brutoMyposOntvangsten - verkochteCadeaubonnen;

  const nettoOmzet = brutoOmzet / (1 + BTW_LAAG / 100);
  const btwBedrag = brutoOmzet - nettoOmzet;

  const regels: {
    rekening: string | null;
    omschrijving: string;
    bedrag: number;
  }[] = [];

  if (brutoOmzet !== 0) {
    regels.push({
      rekening: "8001",
      omschrijving: "Verkopen laag excl. cadeaubonnen",
      bedrag: rondAf(nettoOmzet),
    });

    regels.push({
      rekening: null,
      omschrijving: "Af te dragen BTW 9%",
      bedrag: rondAf(btwBedrag),
    });
  }

  if (totalen["4567"]) {
    regels.push({
      rekening: "4567",
      omschrijving: "Kosten MyPOS",
      bedrag: rondAf(totalen["4567"]),
    });
  }

  if (totalen["1223"]) {
    regels.push({
      rekening: "1223",
      omschrijving: "Kruisposten MyPOS",
      bedrag: rondAf(totalen["1223"]),
    });
  }

  const saldo = regels.reduce((sum, r) => sum + r.bedrag, 0);

  return NextResponse.json({
    maand,
    regels,
    saldo: rondAf(saldo),
    controle: {
      brutoMyposOntvangsten: rondAf(brutoMyposOntvangsten),
      verkochteCadeaubonnen: rondAf(verkochteCadeaubonnen),
      brutoOmzetNaCorrectie: rondAf(brutoOmzet),
    },
  });
}