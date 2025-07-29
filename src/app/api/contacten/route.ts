// src/app/api/contacten/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const result = await db.query(
    `SELECT id, naam, bedrijfsnaam, type, debiteurennummer, rubriek, telefoon, email, website, opmerking
     FROM admin_contacten ORDER BY naam ASC`
  );
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { naam, bedrijfsnaam, type, debiteurennummer, rubriek, telefoon, email, website, opmerking } = body;

  const result = await db.query(
    `INSERT INTO admin_contacten
     (naam, bedrijfsnaam, type, debiteurennummer, rubriek, telefoon, email, website, opmerking)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [naam, bedrijfsnaam, type, debiteurennummer, rubriek, telefoon, email, website, opmerking]
  );

  return NextResponse.json(result.rows[0]);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, naam, bedrijfsnaam, type, debiteurennummer, rubriek, telefoon, email, website, opmerking } = body;

  const result = await db.query(
    `UPDATE admin_contacten
     SET naam = $1,
         bedrijfsnaam = $2,
         type = $3,
         debiteurennummer = $4,
         rubriek = $5,
         telefoon = $6,
         email = $7,
         website = $8,
         opmerking = $9
     WHERE id = $10 RETURNING *`,
    [naam, bedrijfsnaam, type, debiteurennummer, rubriek, telefoon, email, website, opmerking, id]
  );

  return NextResponse.json(result.rows[0]);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id'));

  if (!id || isNaN(id)) {
    return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 });
  }

  await db.query('DELETE FROM admin_contacten WHERE id = $1', [id]);
  return NextResponse.json({ success: true });
}
