// src/app/api/admin/rapportages/ziekteverzuim/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const result = await db.query(
      `SELECT z.id, z.van, z.tot, z.opmerking, m.naam as medewerker_naam
       FROM ziekteverzuim z
       JOIN medewerkers m ON z.medewerker_id = m.id
       ORDER BY z.van DESC`
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Fout bij ophalen ziekteverzuimrapportage:', error);
    return NextResponse.json({ error: 'Fout bij ophalen data' }, { status: 500 });
  }
}
