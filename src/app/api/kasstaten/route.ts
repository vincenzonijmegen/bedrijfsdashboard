// src/app/api/kasstaten/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from '@/lib/db';

// GET all or by ?datum=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const datum = req.nextUrl.searchParams.get("datum");

  try {
    if (datum) {
      const result = await db.query(`SELECT * FROM kasstaten WHERE datum = $1`, [datum]);
      if (result.rows.length === 0) {
        return NextResponse.json({
          datum,
          contant: 0,
          pin: 0,
          bon: 0,
          cadeaubon: 0,
          vrij: 0,
          totaal: 0
        });
      }
      return NextResponse.json(result.rows[0]);
    }

    const result = await db.query(`SELECT * FROM kasstaten ORDER BY datum DESC`);
    return NextResponse.json(result.rows);
  } catch (e) {
    return NextResponse.json({ error: "Fout bij ophalen" }, { status: 500 });
  }
}

// POST nieuwe kasstaat
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { datum, contant, pin, bon, cadeaubon, vrij } = body;

  try {
    const result = await db.query(
      `INSERT INTO kasstaten (datum, contant, pin, bon, cadeaubon, vrij)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;`,
      [datum, contant, pin, bon, cadeaubon, vrij]
    );
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
    const result = await db.query(
      `UPDATE kasstaten
       SET contant = $1,
           pin = $2,
           bon = $3,
           cadeaubon = $4,
           vrij = $5
       WHERE datum = $6
       RETURNING *;`,
      [contant, pin, bon, cadeaubon, vrij, datum]
    );
    return NextResponse.json(result.rows[0]);
  } catch (e) {
    return NextResponse.json({ error: "Updaten mislukt" }, { status: 400 });
  }
}

// DELETE op datum
export async function DELETE(req: NextRequest) {
  const datum = req.nextUrl.searchParams.get("datum");

  if (!datum) return NextResponse.json({ error: "Geen datum opgegeven" }, { status: 400 });

  try {
    await db.query(`DELETE FROM kasstaten WHERE datum = $1`, [datum]);
    return NextResponse.json({ message: "Verwijderd" });
  } catch (e) {
    return NextResponse.json({ error: "Verwijderen mislukt" }, { status: 400 });
  }
}
