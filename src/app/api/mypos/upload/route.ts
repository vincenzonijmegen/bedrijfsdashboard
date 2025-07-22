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

  // Lees Excelbestand
  let rows: any[] = [];
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet);
  } catch (err) {
    return NextResponse.json({ error: "Kon XLSX-bestand niet lezen: " + String(err) }, { status: 400 });
  }

  // Haal grootboekkoppelingen op uit juiste tabel
  let grootboekMap: Record<string, string> = {};
  try {
    const result = await db.query(`SELECT type_code, gl_rekening FROM mypos_gl_accounts`);
    for (const row of result.rows) {
      grootboekMap[row.type_code] = row.gl_rekening;
    }
  } catch (err) {
    return NextResponse.json({ error: "Fout bij ophalen grootboekcodes: " + String(err) }, { status: 500 });
  }

  // Verwerk transacties
  const txs = rows
    .filter(row => row["Value Date"] && (row["Debit"] || row["Credit"]))
    .map(row => {
      const rawDate = row["Value Date"].toString();
      const match = rawDate.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);
      const value_date = match
        ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`
        : null;

      const typeField = row["Type"] ?? "";
      const descField = row["Description"] ?? "";
      const debit = parseFloat((row["Debit"] ?? 0).toString());
      const credit = parseFloat((row["Credit"] ?? 0).toString());
      const amount = credit > 0 ? credit : debit > 0 ? -debit : 0;

      // Bepaal grootboekcode
      let grootboekcode = "ONBEKEND";
      if (typeField.toLowerCase().includes("fee")) {
        grootboekcode = "AF";
      } else if (typeField.toLowerCase().includes("online payment")) {
        grootboekcode = "CR";
      } else if (typeField.toLowerCase().includes("outgoing bank transfer")) {
        grootboekcode = "OV";
      } else if (typeField.toLowerCase().includes("payment")) {
        grootboekcode = "BI";
      }

      // Zoek rekeningnummer
      const ledger_account = grootboekMap[grootboekcode] ?? "0000";

      return {
        value_date,
        transaction_type: typeField,
        description: descField,
        amount,
        ledger_account,
      };
    })
    .filter(tx => tx.value_date && !isNaN(tx.amount));

  // Sla op in database
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
