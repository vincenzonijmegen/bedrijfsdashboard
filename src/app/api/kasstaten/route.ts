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
        return NextResponse.json(null);
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
  const { id, datum, contant, pin, bon, cadeaubon, vrij } = body;

  try {
    const result = await db.query(
      `INSERT INTO kasstaten (id, datum, contant, pin, bon, cadeaubon, vrij)
       VALUES ($1, $2, ROUND($3::numeric, 2), ROUND($4::numeric, 2), ROUND($5::numeric, 2), ROUND($6::numeric, 2), ROUND($7::numeric, 2))
       RETURNING *;`,
      [id, datum, contant, pin, bon, cadeaubon, vrij]
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
       SET contant = ROUND($1::numeric, 2),
           pin = ROUND($2::numeric, 2),
           bon = ROUND($3::numeric, 2),
           cadeaubon = ROUND($4::numeric, 2),
           vrij = ROUND($5::numeric, 2)
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
