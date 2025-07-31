// src/app/api/aftekenlijsten/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jaar = searchParams.get('jaar');
  const week = searchParams.get('week');
  const categorie = searchParams.get('categorie');

  const where = [];
  const values: any[] = [];

  if (jaar) {
    where.push('jaar = $' + (values.length + 1));
    values.push(Number(jaar));
  }
  if (week) {
    where.push('week = $' + (values.length + 1));
    values.push(Number(week));
  }
  if (categorie) {
    where.push('categorie = $' + (values.length + 1));
    values.push(categorie);
  }

  const query = `
    SELECT * FROM aftekenlijsten
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY jaar DESC, week DESC, categorie
  `;

  const result = await db.query(query, values);
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { categorie, week, jaar, bestand_url, opmerking } = body;

  if (!categorie || !week || !jaar || !bestand_url) {
    return NextResponse.json({ error: 'Verplichte velden ontbreken' }, { status: 400 });
  }

  const result = await db.query(
    `INSERT INTO aftekenlijsten (categorie, week, jaar, bestand_url, opmerking)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [categorie, week, jaar, bestand_url, opmerking || null]
  );

  return NextResponse.json(result.rows[0]);
}
