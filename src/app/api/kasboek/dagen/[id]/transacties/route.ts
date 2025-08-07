import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const res = await db.query(
    `SELECT * FROM kasboek_transacties WHERE dag_id = $1 ORDER BY id`,
    [params.id]
  );
  return NextResponse.json(res.rows);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { type, categorie, bedrag, btw, omschrijving } = await req.json();
  const res = await db.query(
    `INSERT INTO kasboek_transacties (dag_id, type, categorie, bedrag, btw, omschrijving)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [params.id, type, categorie, bedrag, btw || null, omschrijving || null]
  );
  return NextResponse.json(res.rows[0]);
}
