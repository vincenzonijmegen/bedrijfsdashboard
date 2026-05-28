import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseBedrag(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;

  if (typeof value === "number") {
    return value;
  }

  let raw = String(value).trim();

  if (!raw) return 0;

  raw = raw
    .replace(/€/g, "")
    .replace(/\u00A0/g, "")
    .replace(/\s/g, "");

  let negatief = false;

  // Boekhoudnotatie: (123,45)
  if (raw.startsWith("(") && raw.endsWith(")")) {
    negatief = true;
    raw = raw.slice(1, -1);
  }

  // Notatie: -123,45
  if (raw.startsWith("-")) {
    negatief = true;
    raw = raw.slice(1);
  }

  // Notatie: 123,45-
  if (raw.endsWith("-")) {
    negatief = true;
    raw = raw.slice(0, -1);
  }

  // Europese notatie: 1.234,56
  // Engelse notatie: 1234.56
  if (raw.includes(",") && raw.includes(".")) {
    raw = raw.replace(/\./g, "").replace(",", ".");
  } else if (raw.includes(",")) {
    raw = raw.replace(",", ".");
  }

  const parsed = Number(raw);

  if (Number.isNaN(parsed)) {
    throw new Error(`Kan bedrag niet parsen: ${String(value)}`);
  }

  return negatief ? -Math.abs(parsed) : parsed;
}

function bepaalAmount(row: any): number {
  const debitRaw = row["Debit"];
  const creditRaw = row["Credit"];

  const debit = parseBedrag(debitRaw);
  const credit = parseBedrag(creditRaw);

  // Credit is inkomend/positief
  if (credit !== 0) {
    return credit;
  }

  // Debit is normaal uitgaand/negatief.
  // Als MyPOS hem al negatief aanlevert, houden we hem negatief.
  if (debit !== 0) {
    return debit < 0 ? debit : -debit;
  }

  return 0;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json(
      { error: "Geen bestand geüpload." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Lees Excelbestand
  let rows: any[] = [];
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet);
  } catch (err) {
    return NextResponse.json(
      { error: "Kon XLSX-bestand niet lezen: " + String(err) },
      { status: 400 }
    );
  }

  // Haal grootboekkoppelingen op
  const grootboekMap: Record<string, string> = {};
  try {
    const result = await db.query(
      `SELECT type_code, gl_rekening FROM mypos_gl_accounts`
    );

    for (const row of result.rows) {
      grootboekMap[row.type_code] = row.gl_rekening;
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Fout bij ophalen grootboekcodes: " + String(err) },
      { status: 500 }
    );
  }

  // Verwerk transacties
  let txs: any[] = [];

  try {
    txs = rows
      .filter((row) => row["Value Date"] && (row["Debit"] || row["Credit"]))
      .map((row) => {
        const rawDate = row["Value Date"].toString();
        const match = rawDate.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);

        const value_date = match
          ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`
          : null;

        const typeField = row["Type"] ?? "";
        const descField = row["Description"] ?? "";

        const amount = bepaalAmount(row);

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

        const ledger_account = grootboekMap[grootboekcode] ?? "0000";

        return {
          value_date,
          transaction_type: typeField,
          description: descField,
          amount,
          ledger_account,
        };
      })
      .filter((tx) => tx.value_date && !Number.isNaN(tx.amount));
  } catch (err) {
    return NextResponse.json(
      { error: "Fout bij verwerken bedragen uit XLS: " + String(err) },
      { status: 400 }
    );
  }

  // Bulk insert in batches
  const BATCH_SIZE = 500;

  try {
    for (let i = 0; i < txs.length; i += BATCH_SIZE) {
      const batch = txs.slice(i, i + BATCH_SIZE);
      const values: any[] = [];
      const placeholders: string[] = [];

      batch.forEach((tx, j) => {
        const idx = j * 5;

        placeholders.push(
          `($${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5})`
        );

        values.push(
          tx.value_date,
          tx.transaction_type,
          tx.description,
          tx.amount,
          tx.ledger_account
        );
      });

      const query = `
        INSERT INTO mypos_transactions
        (value_date, transaction_type, description, amount, ledger_account)
        VALUES ${placeholders.join(", ")}
      `;

      await db.query(query, values);
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Fout bij bulk insert in DB: " + String(err) },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    imported: txs.length,
  });
}