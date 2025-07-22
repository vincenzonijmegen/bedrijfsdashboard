import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Geen bestand geüpload." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Probeer het Excelbestand te lezen
  let rows: any[] = [];
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet); // kolomnamen blijven behouden
    rows = Array.isArray(json) ? json : [];
  } catch (err) {
    return NextResponse.json({ error: "Kon XLSX-bestand niet lezen: " + String(err) }, { status: 400 });
  }

  const txs = rows
    .filter((row) => row["Value Date"] && (row["Debit"] || row["Credit"]))
    .map((row) => {
      // Datum omzetten naar YYYY-MM-DD
      const rawDate = row["Value Date"].toString();
      const match = rawDate.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);
      const value_date = match
        ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`
        : null;

      const typeField = row["Type"] ?? "";
      const descField = row["Description"] ?? "";
      const debit = parseFloat((row["Debit"] ?? 0).toString());
      const credit = parseFloat((row["Credit"] ?? 0).toString());
      const amount = debit > 0 ? debit : credit > 0 ? -credit : 0;

      let ledger = "9999";
      if (typeField.startsWith("BIJ")) ledger = "1111";
      else if (typeField.toLowerCase().includes("fee")) ledger = "2222";
      else if (descField.toLowerCase().includes("overboeking")) ledger = "3333";
      else ledger = "4444";

      return {
        value_date,
        transaction_type: typeField,
        description: descField,
        amount,
        ledger_account: ledger,
      };
    })
    .filter((tx) => tx.value_date !== null && !isNaN(tx.amount));

  // Voeg transacties toe aan de database
  try {
    for (const tx of txs) {
      await db.query(
        `INSERT INTO mypos_transactions
         (value_date, transaction_type, description, amount, ledger_account)
         VALUES ($1, $2, $3, $4, $5)`,
        [tx.value_date, tx.transaction_type, tx.description, tx.amount, tx.ledger_account]
      );
    }
  } catch (err) {
    return NextResponse.json({ error: "Fout bij insert in DB: " + String(err) }, { status: 500 });
  }

  return NextResponse.json({ success: true, imported: txs.length });
}
