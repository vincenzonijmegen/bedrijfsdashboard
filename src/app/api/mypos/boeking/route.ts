import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const maand = searchParams.get("maand"); // formaat: YYYY-MM

  if (!maand || !/^\d{4}-\d{2}$/.test(maand)) {
    return NextResponse.json({ error: "Ongeldige maandparameter. Gebruik formaat YYYY-MM." }, { status: 400 });
  }

  const beginDatum = `${maand}-01`;

  // Haal alle transacties op voor deze maand
  let transacties;
  try {
    const result = await db.query(
      `SELECT ledger_account, amount
       FROM mypos_transactions
       WHERE DATE_TRUNC('month', value_date) = DATE_TRUNC('month', $1::date)`,
      [beginDatum]
    );
    transacties = result.rows;
  } catch (err) {
    return NextResponse.json({ error: "Fout bij ophalen transacties: " + String(err) }, { status: 500 });
  }

  // Sommeer bedragen per grootboekrekening
  const totalen: Record<string, number> = {};
  for (const tx of transacties) {
    const rekening = tx.ledger_account;
    const bedrag = parseFloat(tx.amount);
    if (!rekening) continue;
    totalen[rekening] = (totalen[rekening] ?? 0) + bedrag;
  }

  // BTW-berekening voor 8001
  const brutoOmzet = totalen["8001"] ?? 0;
  const nettoOmzet = brutoOmzet / 1.09;
  const btwBedrag = brutoOmzet - nettoOmzet;

  // Opbouw van regels
  const regels = [];

  if (brutoOmzet > 0) {
    regels.push({
      rekening: "8001",
      omschrijving: "Verkopen laag",
      bedrag: parseFloat(nettoOmzet.toFixed(2)),
    });
    regels.push({
      rekening: null,
      omschrijving: "Af te dragen BTW 9%",
      bedrag: parseFloat(btwBedrag.toFixed(2)),
    });
  }

  if (totalen["4567"])
    regels.push({
      rekening: "4567",
      omschrijving: "Kosten MyPOS",
      bedrag: parseFloat(totalen["4567"].toFixed(2)),
    });

  if (totalen["1223"])
    regels.push({
      rekening: "1223",
      omschrijving: "Kruisposten MyPOS",
      bedrag: parseFloat(totalen["1223"].toFixed(2)),
    });

  // Saldo berekening
  const saldo = regels.reduce((sum, r) => sum + r.bedrag, 0);

  return NextResponse.json({
    maand,
    regels,
    saldo: parseFloat(saldo.toFixed(2)),
  });
}
