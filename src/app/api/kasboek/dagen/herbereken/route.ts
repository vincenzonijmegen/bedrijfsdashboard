import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Normaliseer elke mogelijke datumkolom naar DATE (werkt voor DATE, TIMESTAMP, TEXT)
const NORM = (alias: string) =>
  `to_date(substr(${alias}.datum::text, 1, 10), 'YYYY-MM-DD')`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const vanafDatumInput: string | undefined = body?.vanafDatum;
  const vanaf = (vanafDatumInput ?? '').slice(0, 10);

  if (!vanaf) {
    return NextResponse.json({ error: 'vanafDatum (YYYY-MM-DD) is verplicht' }, { status: 400 });
  }

  const client = await db.connect(); // db is een pg.Pool in jouw setup
  try {
    await client.query('BEGIN');

    // 1) Alle dagen vanaf (genormaliseerd), in volgorde
    const dagenRes = await client.query(
      `
      SELECT id, ${NORM('d')} AS datum_norm
      FROM kasboek_dagen d
      WHERE ${NORM('d')} >= $1::date
      ORDER BY ${NORM('d')} ASC
      `,
      [vanaf]
    );
    const dagen = dagenRes.rows as Array<{ id: number; datum_norm: string }>;

    // 2) Eindsaldo van dag vóór 'vanaf' (genormaliseerd)
    const prevRes = await client.query(
      `
      SELECT eindsaldo
      FROM kasboek_dagen d
      WHERE ${NORM('d')} < $1::date
      ORDER BY ${NORM('d')} DESC
      LIMIT 1
      `,
      [vanaf]
    );
    let vorigeEindsaldo = Number(prevRes.rows?.[0]?.eindsaldo ?? 0);

    // 3) Per dag: som ontvangsten/uitgaven en update start+eind
    for (const dag of dagen) {
      const dagId = dag.id;

      const sumsRes = await client.query(
        `
        SELECT
          COALESCE(SUM(CASE WHEN type = 'ontvangst' THEN bedrag ELSE 0 END), 0)::numeric AS inkomsten,
          COALESCE(SUM(CASE WHEN type = 'uitgave'   THEN bedrag ELSE 0 END), 0)::numeric AS uitgaven
        FROM kasboek_transacties
        WHERE dag_id = $1
        `,
        [dagId]
      );

      const inkomsten = Number(sumsRes.rows[0].inkomsten || 0);
      const uitgaven  = Number(sumsRes.rows[0].uitgaven  || 0);
      const eindsaldo = Number(vorigeEindsaldo) + inkomsten - uitgaven;

      await client.query(
        `UPDATE kasboek_dagen SET startbedrag = $2, eindsaldo = $3 WHERE id = $1`,
        [dagId, vorigeEindsaldo, eindsaldo]
      );

      vorigeEindsaldo = eindsaldo;
    }

    await client.query('COMMIT');
    return NextResponse.json({ status: 'ok', vanafDatum: vanaf, bijgewerkt: dagen.length });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('POST /api/kasboek/dagen/herbereken error', err);
    return NextResponse.json({ error: 'Herberekenen mislukt' }, { status: 500 });
  } finally {
    client.release();
  }
}
