/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_, { params }) {
  const res = await db.query(
    `SELECT * FROM kasboek_transacties WHERE dag_id = $1 ORDER BY id`,
    [params.id]
  );
  return NextResponse.json(res.rows);
}

export async function PUT(req, { params }) {
  const dagId = params.id;
  const transacties = await req.json();

  await db.query(`DELETE FROM kasboek_transacties WHERE dag_id = $1`, [dagId]);

  for (const t of transacties) {
    await db.query(
      `INSERT INTO kasboek_transacties (dag_id, type, categorie, bedrag, btw, omschrijving)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [dagId, t.type, t.categorie, t.bedrag, t.btw, t.omschrijving || null]
    );
  }

  return NextResponse.json({ status: 'ok' });
}
