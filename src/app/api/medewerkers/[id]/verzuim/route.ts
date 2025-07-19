// ✅ STRIKT GEACCEPTEERDE VERSIE – werkt in Next.js 15.3.3 op Vercel

// src/app/api/medewerkers/[id]/verzuim/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
): Promise<Response> {
  const medewerkerId = context.params.id;
  const result = await db.query(
    'SELECT * FROM ziekteverzuim WHERE medewerker_id = $1 ORDER BY van DESC',
    [medewerkerId]
  );
  return NextResponse.json(result.rows);
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
): Promise<Response> {
  const medewerkerId = context.params.id;
  const { van, tot, opmerking } = await request.json();
  await db.query(
    'INSERT INTO ziekteverzuim (medewerker_id, van, tot, opmerking) VALUES ($1, $2, $3, $4)',
    [medewerkerId, van, tot, opmerking]
  );
  return NextResponse.json({ success: true });
}