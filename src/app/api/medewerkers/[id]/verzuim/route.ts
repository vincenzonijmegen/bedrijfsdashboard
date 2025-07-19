// src/app/api/medewerkers/[id]/verzuim/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Fetch all ziekteverzuim entries for a specific medewerker_id
// Fetch all ziekteverzuim entries for a specific medewerker_id
export async function GET(req: NextRequest, context: any) {
  const medewerkerId = context.params.id; params }: { params: { id: string } }
) {
  const medewerkerId = params.id;
  const result = await db.query(
    'SELECT * FROM ziekteverzuim WHERE medewerker_id = $1 ORDER BY van DESC',
    [medewerkerId]
  );
  return NextResponse.json(result.rows);
}

// Add a new ziekteverzuim entry for a specific medewerker_id
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const medewerkerId = params.id;
  const { van, tot, opmerking } = await req.json();
  await db.query(
    'INSERT INTO ziekteverzuim (medewerker_id, van, tot, opmerking) VALUES ($1, $2, $3, $4)',
    [medewerkerId, van, tot, opmerking]
  );
  return NextResponse.json({ success: true });
}
