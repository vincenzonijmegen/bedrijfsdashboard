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

  // Lees bestand
  const buffer = await file.arrayBuffer();
  let content = Buffer.from(buffer).toString('utf-8');
  // Verwijder BOM
  content = content.replace(/\uFEFF/, '');

  // Parse CSV met comma als delimiter en alleen benodigde kolommen
  let records: any[];
  try {
    records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ',',
      trim: true,
      relax_column_count: true
    }) as any[];
  } catch (err) {
    return NextResponse.json({ error: 'Fout bij parseren CSV: ' + String(err) }, { status: 400 });
  }

  // Map naar transacties (alleen relevante velden)
  const txs = records
    .filter(r => r['Value Date'])
    .map((r: any) => {
      // Verwerk waarde-datum (DD.MM.YYYY of DD.MM.YYYY HH:mm)
      const rawDate = (r['Value Date'] ?? '').split(' ')[0];
      const [day, month, year] = rawDate.split('.');
      const value_date = year && month && day
        ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
        : null;

      const rawDebit = r['Debit'] ?? '';
      const rawCredit = r['Credit'] ?? '';
      const amount = rawDebit
        ? parseFloat(rawDebit.replace(/\./g, '').replace(/,/, '.'))
        : -parseFloat(rawCredit.replace(/\./g, '').replace(/,/, '.'));

      const typeField = String(r['Type'] ?? '').trim();
      const descField = String(r['Description'] ?? '').trim();

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
    });

  // Insert in database
  try {
    for (const tx of txs) {
      await db.query(
        `INSERT INTO mypos_transactions
         (value_date, transaction_type, description, amount, ledger_account)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          tx.value_date,
          tx.transaction_type,
          tx.description,
          tx.amount,
          tx.ledger_account,
        ]
      );
    }
  } catch (err) {
    return NextResponse.json({ error: 'Fout bij insert in DB: ' + String(err) }, { status: 500 });
  }

  return NextResponse.json({ success: true, imported: txs.length });
}