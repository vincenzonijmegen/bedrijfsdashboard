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

    if (!rekening) continue;

    totalen[rekening] = (totalen[rekening] ?? 0) + bedrag;
  }

  /*
    Verkochte cadeaubonnen worden in de kasstaat vastgelegd
    en in de kas-JP geboekt op 2215.

    Omdat we cadeaubonnen boekhoudkundig behandelen alsof ze via pin zijn betaald,
    moeten ze uit de MyPOS-omzetbasis worden gehaald.
    Anders wordt er in deze JP opnieuw omzet/btw over berekend.
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

  // MyPOS 8001 bevat de bruto ontvangsten.
  // Daar halen we de verkochte cadeaubonnen uit voordat we btw berekenen.
  const brutoMyposOntvangsten = totalen["8001"] ?? 0;
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

  // Informatieve correctieregel, niet op grootboek boeken.
  // Hiermee zie je waarom de MyPOS-omzet lager is dan de bruto ontvangsten.
  if (verkochteCadeaubonnen !== 0) {
    regels.push({
      rekening: null,
      omschrijving: "Correctie verkochte cadeaubonnen via kas-JP/2215",
      bedrag: -rondAf(verkochteCadeaubonnen),
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