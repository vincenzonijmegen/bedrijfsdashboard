/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { vanafDatum } = await req.json();

  const { rows: dagen } = await db.query(
    `SELECT * FROM kasboek_dagen WHERE datum >= $1 ORDER BY datum ASC`,
    [vanafDatum]
  );

  let vorigeEindsaldo = (
    await db.query(
      `SELECT eindsaldo FROM kasboek_dagen WHERE datum < $1 ORDER BY datum DESC LIMIT 1`,
      [vanafDatum]
    )
  ).rows[0]?.eindsaldo ?? 0;

  for (const dag of dagen) {
    const dagId = dag.id;

    const { rows: transacties } = await db.query(
      `SELECT * FROM kasboek_transacties WHERE dag_id = $1`,
      [dagId]
    );

    let ontvangst = 0;
    let uitgave = 0;
    for (const tx of transacties) {
      if (tx.type === 'ontvangst') ontvangst += parseFloat(tx.bedrag);
      if (tx.type === 'uitgave') uitgave += parseFloat(tx.bedrag);
    }

    const eindsaldo = parseFloat(vorigeEindsaldo) + ontvangst - uitgave;

    await db.query(
      `UPDATE kasboek_dagen SET startbedrag = $1, eindsaldo = $2 WHERE id = $3`,
      [vorigeEindsaldo, eindsaldo, dagId]
    );

    vorigeEindsaldo = eindsaldo;
  }

  return NextResponse.json({ status: 'ok' });
}
