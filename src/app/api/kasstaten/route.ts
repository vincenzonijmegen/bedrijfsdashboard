// src/app/api/kasstaten/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from '@/lib/db';

// GET all or by ?datum=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const datum = req.nextUrl.searchParams.get("datum");

  if (datum) {
    const result = await db.query(`SELECT * FROM kasstaten WHERE datum = ${datum}`);
    return NextResponse.json(result.rows?.[0] || null);
  }

  const result = await db.query(`SELECT * FROM kasstaten ORDER BY datum DESC`);
  return NextResponse.json(result.rows);
}

// POST nieuwe kasstaat
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { datum, contant, pin, bon, cadeaubon, vrij } = body;

  try {
    const result = await db.query(`INSERT INTO kasstaten (datum, contant, pin, bon, cadeaubon, vrij)
      VALUES (${datum}, ${contant}, ${pin}, ${bon}, ${cadeaubon}, ${vrij}) RETURNING *;`);
    return NextResponse.json(result.rows[0]);
  } catch (e) {
    return NextResponse.json({ error: "Invoeren mislukt" }, { status: 400 });
  }
}

// PUT update bestaande kasstaat
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { datum, contant, pin, bon, cadeaubon, vrij } = body;

  try {
    const result = await db.query(`
      UPDATE kasstaten
      SET contant = ${contant},
          pin = ${pin},
          bon = ${bon},
          cadeaubon = ${cadeaubon},
          vrij = ${vrij}
      WHERE datum = ${datum}
      RETURNING *;
    `);
    return NextResponse.json(result.rows[0]);
  } catch (e) {
    return NextResponse.json({ error: "Updaten mislukt" }, { status: 400 });
  }
}

// DELETE op datum
export async function DELETE(req: NextRequest) {
  const datum = req.nextUrl.searchParams.get("datum");

  if (!datum) return NextResponse.json({ error: "Geen datum opgegeven" }, { status: 400 });

  await db.query(`DELETE FROM kasstaten WHERE datum = ${datum}`);
  return NextResponse.json({ message: "Verwijderd" });
}
