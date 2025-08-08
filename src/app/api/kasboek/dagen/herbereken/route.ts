import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Normaliseer datumkolom (werkt voor DATE/TIMESTAMP/TEXT 'YYYY-MM-DD')
const NORM = (alias: string) =>
  `to_date(substr(${alias}.datum::text, 1, 10), 'YYYY-MM-DD')`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const vanaf = String(body?.vanafDatum ?? '').slice(0, 10);
  if (!vanaf) {
    return NextResponse.json({ error: 'vanafDatum (YYYY-MM-DD) is verplicht' }, { status: 400 });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Snelle herberekening via window function
    const sql = `
      WITH seed AS (
        SELECT COALESCE((
          SELECT d.eindsaldo
          FROM kasboek_dagen d
          WHERE ${NORM('d')} < $1::date
          ORDER BY ${NORM('d')} DESC
          LIMIT 1
        ), 0)::numeric AS start_prev
      ),
      d AS (
        SELECT id, ${NORM('d')} AS datum
        FROM kasboek_dagen d
        WHERE ${NORM('d')} >= $1::date
        ORDER BY ${NORM('d')} ASC
      ),
      sums AS (
        SELECT
          dag_id,
          COALESCE(SUM(CASE WHEN type = 'ontvangst' THEN bedrag ELSE 0 END), 0)::numeric AS inkomsten,
          COALESCE(SUM(CASE WHEN type = 'uitgave'   THEN bedrag ELSE 0 END), 0)::numeric AS uitgaven
        FROM kasboek_transacties
        WHERE dag_id IN (SELECT id FROM d)
        GROUP BY dag_id
      ),
      j AS (
        SELECT
          d.id,
          d.datum,
          COALESCE(s.inkomsten, 0) AS inkomsten,
          COALESCE(s.uitgaven, 0)  AS uitgaven
        FROM d
        LEFT JOIN sums s ON s.dag_id = d.id
        ORDER BY d.datum
      ),
      roll AS (
        SELECT
          j.*,
          -- cumulatief (inkomsten - uitgaven) + start_prev
          (SUM(j.inkomsten - j.uitgaven) OVER (ORDER BY j.datum))
          + (SELECT start_prev FROM seed) AS eindsaldo_calc
        FROM j
      ),
      final AS (
        SELECT
          id,
          datum,
          -- startbedrag is vorige eindsaldo of seed.start_prev voor de 1e dag
          COALESCE(LAG(eindsaldo_calc) OVER (ORDER BY datum), (SELECT start_prev FROM seed)) AS startbedrag_new,
          eindsaldo_calc AS eindsaldo_new
        FROM roll
      )
      UPDATE kasboek_dagen d
      SET startbedrag = f.startbedrag_new,
          eindsaldo   = f.eindsaldo_new
      FROM final f
      WHERE d.id = f.id
      RETURNING d.id;
    `;

    const r = await client.query(sql, [vanaf]);
    await client.query('COMMIT');

    return NextResponse.json({ status: 'ok', vanafDatum: vanaf, bijgewerkt: r.rowCount ?? 0 });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('POST /api/kasboek/dagen/herbereken error', err);
    return NextResponse.json({ error: 'Herberekenen mislukt' }, { status: 500 });
  } finally {
    client.release();
  }
}
