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

  const buffer = await file.arrayBuffer();
  let content = Buffer.from(buffer).toString('utf-8');
  content = content.replace(/^\uFEFF/, '');

  // Eerste ruwe parse (elke regel als string)
  const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
  const dataLines = lines.slice(1); // sla header over

  // Splits elke regel met CSV-logica (komma, met quotes)
  let rows: string[][];
  try {
    rows = parse(dataLines.join('\n'), {
      delimiter: ',',
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
      quote: '"',
    });
  } catch (err) {
    return NextResponse.json({ error: 'Fout bij parseren CSV: ' + String(err) }, { status: 400 });
  }

  const txs = rows
    .filter(row => row.length >= 8 && row[0]) // alleen geldige rijen
    .map(row => {
      const rawDate = row[0] || '';
      const dateMatch = rawDate.match(/(\d{1,2})[\.\-/](\d{1,2})[\.\-/](\d{4})/);
      const value_date = dateMatch
        ? `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`
        : null;

      const typeField = row[2] ?? '';
      const descField = row[4] ?? '';
      const rawDebit = row[6]?.replace(',', '.') ?? '';
      const rawCredit = row[7]?.replace(',', '.') ?? '';

      const amount = rawDebit
        ? parseFloat(rawDebit)
        : rawCredit
          ? -parseFloat(rawCredit)
          : 0;

      let ledger = '9999';
      if (typeField.startsWith('BIJ')) ledger = '1111';
      else if (typeField.toLowerCase().includes('fee')) ledger = '2222';
      else if (descField.toLowerCase().includes('overboeking')) ledger = '3333';
      else ledger = '4444';

      return { value_date, transaction_type: typeField, description: descField, amount, ledger_account: ledger };
    })
    .filter(tx => tx.value_date !== null && !isNaN(tx.amount));

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
