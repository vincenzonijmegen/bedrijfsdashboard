// File: src/app/api/mypos/upload/route.ts

import { NextRequest, NextResponse } from "next/server";
import { parse } from 'csv-parse/sync';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  // Expect multipart/form-data with a 'file' field
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Geen CSV-bestand geüpload.' }, { status: 400 });
  }

  // Read file content
  const buffer = await file.arrayBuffer();
  const content = Buffer.from(buffer).toString('utf-8');

  // Parse CSV (separator: comma, decimal point: dot)
  let records;
  try {
    records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ',',
    });
  } catch (err) {
    return NextResponse.json({ error: 'Fout bij parseren CSV: ' + String(err) }, { status: 400 });
  }

  // Map naar transacties
  const txs = records.map((r: any) => {
    const date = r['Value Date'];
    const rawDebit = r['Debit'] || '';
    const rawCredit = r['Credit'] || '';
    const amount = rawDebit
      ? parseFloat(rawDebit)
      : -parseFloat(rawCredit);

    let ledger = '9999';
    if (r['Type'].startsWith('BIJ')) ledger = '1111';
    else if (r['Type'].includes('Fee')) ledger = '2222';
    else if (r['Description'].toLowerCase().includes('overboeking')) ledger = '3333';
    else ledger = '4444';

    return {
      date,
      ordered_via: r['Ordered Via'] || '',
      type: r['Type'],
      reference: r['Reference Number'],
      description: r['Description'],
      amount,
      ledger_account: ledger,
    };
  });

  // Insert in database via raw SQL
  for (const tx of txs) {
    await db.query(
      `INSERT INTO mypos_transactions
       (date, ordered_via, type, reference, description, amount, ledger_account)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        tx.date,
        tx.ordered_via,
        tx.type,
        tx.reference,
        tx.description,
        tx.amount,
        tx.ledger_account,
      ]
    );
  }

  return NextResponse.json({ success: true, imported: txs.length });
}