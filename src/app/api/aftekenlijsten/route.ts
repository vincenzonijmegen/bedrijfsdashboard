// src/app/api/aftekenlijsten/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// GET /api/aftekenlijsten?jaar=2025&week=32&categorie=inspectierapporten
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jaar = searchParams.get('jaar');
  const week = searchParams.get('week');
  const categorie = searchParams.get('categorie');

  const where: string[] = [];
  const values: any[] = [];

  if (jaar) {
    where.push(`jaar = $${values.length + 1}`);
    values.push(Number(jaar));
  }
  if (week) {
    where.push(`week = $${values.length + 1}`);
    values.push(Number(week));
  }
  if (categorie) {
    where.push(`categorie = $${values.length + 1}`);
    values.push(categorie);
  }

  const sql = `
    SELECT id, categorie, week, jaar, opmerking, bestand_url
    FROM aftekenlijsten
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY jaar DESC, week DESC, categorie, id DESC
  `;

  const result = await db.query(sql, values);

  // Consistente types richting frontend
  const rows = result.rows.map((r: any) => ({
    id: Number(r.id),
    categorie: String(r.categorie),
    week: Number(r.week),
    jaar: Number(r.jaar),
    opmerking: r.opmerking ?? null,
    bestand_url: r.bestand_url ?? null,
  }));

  return NextResponse.json(rows);
}

// POST /api/aftekenlijsten
// body: { categorie, week, jaar, bestand_url, opmerking? }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { categorie, week, jaar, bestand_url, opmerking } = body;

  if (!categorie || !week || !jaar || !bestand_url) {
    return NextResponse.json({ error: 'Verplichte velden ontbreken' }, { status: 400 });
  }

  const result = await db.query(
    `INSERT INTO aftekenlijsten (categorie, week, jaar, bestand_url, opmerking)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, categorie, week, jaar, opmerking, bestand_url`,
    [categorie, Number(week), Number(jaar), String(bestand_url), opmerking ?? null]
  );

  return NextResponse.json(result.rows[0]);
}

// DELETE /api/aftekenlijsten
// body: { id }
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'id is verplicht' }, { status: 400 });
  }

  const res = await db.query(`DELETE FROM aftekenlijsten WHERE id = $1`, [Number(id)]);
  if (res.rowCount === 0) {
    return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
