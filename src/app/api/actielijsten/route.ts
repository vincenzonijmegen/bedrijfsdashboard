// Bestand: src/app/api/actielijsten/route.ts
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const lijsten = await db.query('SELECT id, naam, icoon FROM actielijsten ORDER BY id');
    return NextResponse.json(lijsten.rows);
  } catch (err) {
    console.error("Fout bij ophalen actielijsten:", err);
    return NextResponse.json({ error: "Fout bij ophalen actielijsten" }, { status: 500 });
  }
}