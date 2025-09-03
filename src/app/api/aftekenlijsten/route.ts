import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// GET /api/aftekenlijsten?jaar=2025&week=32&categorie=inspectierapporten&type=template|ingevuld|all
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jaar = searchParams.get('jaar');
  const week = searchParams.get('week');
  const categorie = searchParams.get('categorie');
  const type = (searchParams.get('type') || 'ingevuld').toLowerCase(); // default: alleen ingevuld

  const where: string[] = [];
  const values: any[] = [];

  // Filter op type (alleen gebruiken als kolom bestaat in DB-migratie)
  if (type === 'ingevuld') {
    where.push(`(is_template = false)`);
  } else if (type === 'template') {
    where.push(`(is_template = true)`);
  } // 'all' voegt geen filter toe

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
    SELECT id, categorie, week, jaar, opmerking, bestand_url, is_template, template_naam, ext
    FROM aftekenlijsten
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY COALESCE(jaar, 0) DESC, COALESCE(week, 0) DESC, categorie, id DESC
  `;

  const result = await db.query(sql, values);

  // Consistente types richting frontend (oude velden blijven bestaan)
  const rows = result.rows.map((r: any) => ({
    id: Number(r.id),
    categorie: String(r.categorie),
    week: r.week == null ? null : Number(r.week),
    jaar: r.jaar == null ? null : Number(r.jaar),
    opmerking: r.opmerking ?? null,
    bestand_url: r.bestand_url ?? null,
    is_template: !!r.is_template,
    template_naam: r.template_naam ?? null,
    ext: r.ext ?? null,
  }));

  return NextResponse.json(rows);
}

// POST /api/aftekenlijsten
// body (ingevuld): { categorie, week, jaar, bestand_url, opmerking? }
// body (template): { categorie, bestand_url, opmerking?, is_template: true, template_naam?, ext? }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    categorie,
    week,
    jaar,
    bestand_url,
    opmerking,
    is_template = false,
    template_naam = null,
    ext = null,
  } = body || {};

  // Altijd vereist
  if (!categorie || !bestand_url) {
    return NextResponse.json({ error: 'Verplichte velden ontbreken' }, { status: 400 });
  }

  // Validatie per type
  if (!is_template) {
    const w = Number(week);
    const j = Number(jaar);
    if (!w || w < 1 || w > 53 || !j) {
      return NextResponse.json(
        { error: 'Week en jaar zijn verplicht (week 1–53) voor ingevulde formulieren' },
        { status: 400 }
      );
    }

    // Oud gedrag (ingevuld) – week/jaar aanwezig
    const result = await db.query(
      `INSERT INTO aftekenlijsten
         (categorie, week, jaar, bestand_url, opmerking, is_template)
       VALUES ($1, $2, $3, $4, $5, false)
       RETURNING id, categorie, week, jaar, opmerking, bestand_url, is_template`,
      [String(categorie), w, j, String(bestand_url), opmerking ?? null]
    );

    return NextResponse.json(result.rows[0]);
  }

  // Nieuw gedrag (template) – geen week/jaar
  const result = await db.query(
    `INSERT INTO aftekenlijsten
       (categorie, week, jaar, bestand_url, opmerking, is_template, template_naam, ext)
     VALUES ($1, NULL, NULL, $2, $3, true, $4, $5)
     RETURNING id, categorie, week, jaar, opmerking, bestand_url, is_template, template_naam, ext`,
    [String(categorie), String(bestand_url), opmerking ?? null, template_naam, ext]
  );

  return NextResponse.json(result.rows[0], { status: 201 });
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
