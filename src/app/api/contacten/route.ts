// src/app/api/contacten/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// SQL migration (run once):
// ALTER TABLE admin_contacten ADD COLUMN bedrijfsnaam TEXT, ADD COLUMN debiteurennummer TEXT, ADD COLUMN rubriek TEXT;
// CREATE TABLE admin_contactpersonen (
//   id SERIAL PRIMARY KEY,
//   bedrijf_id INTEGER NOT NULL REFERENCES admin_contacten(id) ON DELETE CASCADE,
//   naam TEXT NOT NULL,
//   telefoon TEXT,
//   email TEXT,
//   volgorde INTEGER DEFAULT 0
// );

// GET: alle bedrijven + hun contactpersonen ophalen
export async function GET() {
  // Haal bedrijven
  const compRes = await db.query(
    `SELECT id, naam, bedrijfsnaam, type, debiteurennummer, rubriek, opmerking
     FROM admin_contacten ORDER BY naam ASC`
  );
  // Haal personen
  const pplRes = await db.query(
    `SELECT id, bedrijf_id, naam, telefoon, email
     FROM admin_contactpersonen ORDER BY volgorde ASC`
  );

  // Groepeer personen per bedrijf
  const personsByCompany: Record<number, any[]> = {};
  for (const p of pplRes.rows) {
    if (!personsByCompany[p.bedrijf_id]) personsByCompany[p.bedrijf_id] = [];
    personsByCompany[p.bedrijf_id].push({ id: p.id, naam: p.naam, telefoon: p.telefoon, email: p.email });
  }

  // Combineer
  const result = compRes.rows.map(c => ({
    ...c,
    personen: personsByCompany[c.id] || []
  }));

  return NextResponse.json(result);
}

// POST: nieuw bedrijf + personen
export async function POST(req: Request) {
  const body = await req.json();
  const { personen, ...compData } = body;

  // 1) Insert bedrijf
  const compInsert = await db.query(
    `INSERT INTO admin_contacten (naam, bedrijfsnaam, type, debiteurennummer, rubriek, opmerking)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [compData.naam, compData.bedrijfsnaam, compData.type, compData.debiteurennummer, compData.rubriek, compData.opmerking]
  );
  const newId = compInsert.rows[0].id;

  // 2) Insert personen in volgorde
  for (let i = 0; i < (personen || []).length; i++) {
    const p = personen[i];
    await db.query(
      `INSERT INTO admin_contactpersonen (bedrijf_id, naam, telefoon, email, volgorde)
       VALUES ($1, $2, $3, $4, $5)`,
      [newId, p.naam, p.telefoon, p.email, i]
    );
  }

  return NextResponse.json({ success: true, id: newId });
}

// PUT: update bedrijf en contactpersonen
export async function PUT(req: Request) {
  const body = await req.json();
  const { id, personen, ...compData } = body;

  // Update bedrijf
  await db.query(
    `UPDATE admin_contacten
     SET naam=$1, bedrijfsnaam=$2, type=$3, debiteurennummer=$4, rubriek=$5, opmerking=$6
     WHERE id=$7`,
    [compData.naam, compData.bedrijfsnaam, compData.type, compData.debiteurennummer, compData.rubriek, compData.opmerking, id]
  );

  // Verwijder oude personen
  await db.query(`DELETE FROM admin_contactpersonen WHERE bedrijf_id=$1`, [id]);

  // Reinsert personen
  for (let i = 0; i < (personen || []).length; i++) {
    const p = personen[i];
    await db.query(
      `INSERT INTO admin_contactpersonen (bedrijf_id, naam, telefoon, email, volgorde)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, p.naam, p.telefoon, p.email, i]
    );
  }

  return NextResponse.json({ success: true });
}

// DELETE: delete bedrijf (cascade delete personen)
export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  await db.query(`DELETE FROM admin_contacten WHERE id=$1`, [id]);
  return NextResponse.json({ success: true });
}

// Voor contactpersonen CRUD apart kun je routes onder /api/contactpersonen aanmaken.
