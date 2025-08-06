// src/app/api/contacten/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET: alle bedrijven + hun contactpersonen ophalen
export async function GET() {
  const compRes = await db.query(
    `SELECT id, naam, bedrijfsnaam, type, debiteurennummer, rubriek, telefoon, email, website, opmerking
     FROM admin_contacten ORDER BY naam ASC`
  );
  const pplRes = await db.query(
    `SELECT id, bedrijf_id, naam, telefoon, email
     FROM admin_contactpersonen ORDER BY volgorde ASC`
  );

  const personsByCompany: Record<number, any[]> = {};
  for (const p of pplRes.rows) {
    if (!personsByCompany[p.bedrijf_id]) personsByCompany[p.bedrijf_id] = [];
    personsByCompany[p.bedrijf_id].push({ id: p.id, naam: p.naam, telefoon: p.telefoon, email: p.email });
  }

  const result = compRes.rows.map(c => ({
    ...c,
    personen: personsByCompany[c.id] || []
  }));

  return NextResponse.json(result);
}

// POST: nieuw bedrijf + personen
export async function POST(req: Request) {
  const body = await req.json();
  const { personen, naam, bedrijfsnaam, type, debiteurennummer, rubriek, telefoon, email, website, opmerking } = body;

  const compInsert = await db.query(
    `INSERT INTO admin_contacten
       (naam, bedrijfsnaam, type, debiteurennummer, rubriek, telefoon, email, website, opmerking)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [naam, bedrijfsnaam, type, debiteurennummer, rubriek, telefoon, email, website, opmerking]
  );
  const newId = compInsert.rows[0].id;

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
  console.log('[PUT] ontvangen:', body);
  const { id, personen, naam, bedrijfsnaam, type, debiteurennummer, rubriek, telefoon, email, website, opmerking } = body;

  if (!id || !naam || !type) {
    console.error('[PUT] Ontbrekende velden:', { id, naam, type });
    return NextResponse.json({ success: false, error: 'Verplichte velden ontbreken' }, { status: 400 });
  }

  try {
    await db.query(
      `UPDATE admin_contacten
       SET naam=$1, bedrijfsnaam=$2, type=$3, debiteurennummer=$4,
           rubriek=$5, telefoon=$6, email=$7, website=$8, opmerking=$9
       WHERE id=$10`,
      [naam, bedrijfsnaam, type, debiteurennummer, rubriek, telefoon, email, website, opmerking, id]
    );

    await db.query(`DELETE FROM admin_contactpersonen WHERE bedrijf_id=$1`, [id]);

    for (let i = 0; i < (personen || []).length; i++) {
      const p = personen[i];
      await db.query(
        `INSERT INTO admin_contactpersonen (bedrijf_id, naam, telefoon, email, volgorde)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, p.naam, p.telefoon, p.email, i]
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[PUT] fout:', e);
    return NextResponse.json({ success: false, error: 'Update mislukt' }, { status: 500 });
  }
}

// DELETE: bedrijf + gekoppelde personen verwijderen
export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  await db.query(`DELETE FROM admin_contacten WHERE id=$1`, [id]);
  return NextResponse.json({ success: true });
}

// ✅ EXTRA: correspondentie toevoegen
export async function POST_correspondentie(req: Request) {
  const { contact_id, datum, type, omschrijving, bijlage_url } = await req.json();

  if (!contact_id || !type) {
    return NextResponse.json({ success: false, error: 'contact_id of type ontbreekt' }, { status: 400 });
  }

  try {
    await db.query(
      `INSERT INTO admin_correspondentie (contact_id, datum, type, omschrijving, bijlage_url)
       VALUES ($1, $2, $3, $4, $5)`,
      [contact_id, datum, type, omschrijving, bijlage_url]
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[POST_correspondentie] fout:', e);
    return NextResponse.json({ success: false, error: 'Opslaan mislukt' }, { status: 500 });
  }
}
