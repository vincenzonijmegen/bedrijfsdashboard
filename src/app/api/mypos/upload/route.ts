// File: src/app/api/mypos/upload/route.ts

import { NextRequest, NextResponse } from "next/server";
import { parse } from 'csv-parse/sync';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Geen CSV-bestand geüpload.' }, { status: 400 });
  }

  // Lees bestand en verwijder BOM
  const buffer = await file.arrayBuffer();
  const content = Buffer.from(buffer).toString('utf-8').replace(/\uFEFF/, '');

  // Parse CSV zonder header (vanaf regel 2), comma als delimiter
  let rows: string[][];
  try {
    rows = parse(content, {
      delimiter: ',',
      skip_empty_lines: true,
      from_line: 2,
      relax_column_count: true,
      trim: true,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Fout bij parseren CSV: ' + String(err) }, { status: 400 });
  }

  // Map naar transacties (kolommen: 0: Value Date, 2: Type, 4: Description, 6: Debit, 7: Credit)
  const txs = rows.map(row => {
    const rawDate = row[0] || '';
    const [day, month, year] = rawDate.split(' ')[0].split('.');
    const value_date = year && month && day
      ? `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`
      : null;

    const typeField = row[2] ?? '';
    const descField = row[4] ?? '';
    const rawDebit = row[6] ?? '';
    const rawCredit = row[7] ?? '';
    const amount = rawDebit
      ? parseFloat(rawDebit.replace(/\./g,'').replace(/,/,'.'))
      : -parseFloat(rawCredit.replace(/\./g,'').replace(/,/,'.'));

    let ledger = '9999';
    if (typeField.startsWith('BIJ')) ledger = '1111';
    else if (typeField.includes('Fee')) ledger = '2222';
    else if (descField.toLowerCase().includes('overboeking')) ledger = '3333';
    else ledger = '4444';

    return {
      value_date,
      transaction_type: typeField,
      description: descField,
      amount,
      ledger_account: ledger,
    };
  }).filter(tx => tx.value_date && !isNaN(tx.amount));

  // Insert in database
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
    return NextResponse.json({ error: 'Fout bij insert in DB: ' + String(err) }, { status: 500 });
  }

  return NextResponse.json({ success: true, imported: txs.length });
}
