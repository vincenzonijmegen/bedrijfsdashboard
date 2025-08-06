// src/app/api/contacten/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';


// GET: alle bedrijven + hun contactpersonen ophalen
export async function GET() {
  // Haal bedrijven met algemene contactgegevens
  const compRes = await db.query(
    `SELECT id, naam, bedrijfsnaam, type, debiteurennummer, rubriek, telefoon, email, website, opmerking
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
  const { personen, naam, bedrijfsnaam, type, debiteurennummer, rubriek, telefoon, email, website, opmerking } = body;

  // 1) Insert bedrijf
  const compInsert = await db.query(
    `INSERT INTO admin_contacten
       (naam, bedrijfsnaam, type, debiteurennummer, rubriek, telefoon, email, website, opmerking)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [naam, bedrijfsnaam, type, debiteurennummer, rubriek, telefoon, email, website, opmerking]
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

export async function PUT(req: Request) {
  const body = await req.json();
  console.log('[PUT] ontvangen:', body); // << LOGGEN
  
  const { id, personen, naam, bedrijfsnaam, type, debiteurennummer, rubriek, telefoon, email, website, opmerking } = body;

  if (!id || !naam || !type) {
    console.error('[PUT] Ontbrekende velden:', { id, naam, type });
    return NextResponse.json({ success: false, error: 'Verplichte velden ontbreken' }, { status: 400 });
  }

  try {
    // Update bedrijf
    await db.query(
      `UPDATE admin_contacten
       SET naam=$1, bedrijfsnaam=$2, type=$3, debiteurennummer=$4,
           rubriek=$5, telefoon=$6, email=$7, website=$8, opmerking=$9
       WHERE id=$10`,
      [naam, bedrijfsnaam, type, debiteurennummer, rubriek, telefoon, email, website, opmerking, id]
    );

    // Oude personen weg
    await db.query(`DELETE FROM admin_contactpersonen WHERE bedrijf_id=$1`, [id]);

    // Nieuwe personen invoegen
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

// DELETE: delete bedrijf (cascade delete personen)
export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  await db.query(`DELETE FROM admin_contacten WHERE id=$1`, [id]);
  return NextResponse.json({ success: true });
}
