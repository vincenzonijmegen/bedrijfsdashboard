// src/app/api/bestellingen/onderhanden/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// GET: Haal de meest recente onderhanden bestelling per leverancier op
export async function GET(req: NextRequest) {
  const leverancierId = req.nextUrl.searchParams.get('leverancier_id');
  if (!leverancierId) {
    return NextResponse.json({ error: 'leverancier_id is verplicht' }, { status: 400 });
  }

  const result = await pool.query(
    `
      SELECT *
        FROM onderhanden_bestellingen
       WHERE leverancier_id = $1
       ORDER BY laatst_bewerkt DESC
       LIMIT 1
    `,
    [leverancierId]
  );
  return NextResponse.json(result.rows[0] ?? {});
}

// POST: Atomische insert of increment op product_id
export async function POST(req: NextRequest) {
  try {
    const { product_id } = await req.json();
    if (!product_id) {
      return NextResponse.json({ error: 'product_id is verplicht' }, { status: 400 });
    }

    const result = await pool.query(
      `
      INSERT INTO onderhanden_bestellingen (product_id, aantal, laatst_bewerkt)
      VALUES ($1, 1, now())
      ON CONFLICT (product_id)
      DO UPDATE
        SET aantal = onderhanden_bestellingen.aantal + 1,
            laatst_bewerkt = now()
      RETURNING aantal AS nieuweAantal
      `,
      [product_id]
    );

    return NextResponse.json({ success: true, nieuweAantal: result.rows[0].nieuweaantal });
  } catch (err: any) {
    console.error('POST /onderhanden fout:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Verwijder onderhanden bestellingen per leverancier of product
export async function DELETE(req: NextRequest) {
  const leverancierId = req.nextUrl.searchParams.get('leverancier_id');
  const productId = req.nextUrl.searchParams.get('product_id');

  if (leverancierId) {
    await pool.query(
      `DELETE FROM onderhanden_bestellingen WHERE leverancier_id = $1`,
      [leverancierId]
    );
    return NextResponse.json({ success: true, message: `Deleted leverancier ${leverancierId}` });
  }

  if (productId) {
    await pool.query(
      `DELETE FROM onderhanden_bestellingen WHERE product_id = $1`,
      [productId]
    );
    return NextResponse.json({ success: true, message: `Deleted product ${productId}` });
  }

  return NextResponse.json(
    { error: 'leverancier_id of product_id is verplicht voor DELETE' },
    { status: 400 }
  );
}
