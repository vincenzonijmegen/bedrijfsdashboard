import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db'; // of dbAdmin of dbRapportage als dat geldt

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const rows = await db.query(
    'SELECT * FROM ziekteverzuim WHERE medewerker_id = $1 ORDER BY van DESC',
    [params.id]
  );
  return NextResponse.json(rows.rows);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { van, tot, opmerking } = await req.json();
  await db.query(
    `INSERT INTO ziekteverzuim (medewerker_id, van, tot, opmerking)
     VALUES ($1, $2, $3, $4)`,
    [params.id, van, tot, opmerking]
  );
  return NextResponse.json({ success: true });
}
