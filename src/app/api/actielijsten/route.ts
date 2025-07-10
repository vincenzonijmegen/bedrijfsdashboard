// Bestand: src/app/api/actielijsten/route.ts
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const lijsten = await db.query('SELECT id, naam, icoon FROM actielijsten ORDER BY id');
    return NextResponse.json(lijsten.rows);
  } catch (err) {
    console.error("Fout bij ophalen actielijsten:", err);
    return NextResponse.json({ error: "Fout bij ophalen actielijsten" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { naam, icoon } = await req.json();

  if (!naam) {
    return NextResponse.json({ error: "Naam is verplicht" }, { status: 400 });
  }

  const result = await db.query(
    `INSERT INTO actielijsten (naam, icoon) VALUES ($1, $2) RETURNING *`,
    [naam, icoon || "📋"]
  );

  return NextResponse.json(result.rows[0]);
}

export async function PATCH(req: NextRequest) {
  const { id, naam, icoon } = await req.json();

  if (!id || (!naam && !icoon)) {
    return NextResponse.json({ error: "id en minstens één wijziging vereist" }, { status: 400 });
  }

  const result = await db.query(
    `UPDATE actielijsten SET
     naam = COALESCE($2, naam),
     icoon = COALESCE($3, icoon)
     WHERE id = $1
     RETURNING *`,
    [id, naam, icoon]
  );

  return NextResponse.json(result.rows[0]);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "id is verplicht" }, { status: 400 });
  }

  await db.query('DELETE FROM actielijsten WHERE id = $1', [id]);
  return NextResponse.json({ success: true });
}
