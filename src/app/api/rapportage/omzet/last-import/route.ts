// src/app/api/rapportage/omzet/last-import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  // Haal de laatst geïmporteerde datum op uit de omzet-tabel
  const result = await db.query(
    `SELECT MAX(datum)::date AS last_imported
     FROM rapportage.omzet`
  );
  const lastImported = result.rows[0]?.last_imported
    ? result.rows[0].last_imported.toISOString().split('T')[0]
    : null;
  return NextResponse.json({ lastImported });
}