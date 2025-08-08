import { NextResponse } from 'next/server';
import { getClient, query as dbQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

const NORM = (alias: string) =>
  `to_date(substr(${alias}.datum::text, 1, 10), 'YYYY-MM-DD')`;

/* GET /api/kasboek/dagen?maand=YYYY-MM
   → telt transacties per dag via subquery op dag_id */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const maand = searchParams.get('maand'); // 'YYYY-MM'
  if (!maand) {
    return NextResponse.json({ error: 'maand is verplicht (YYYY-MM)' }, { status: 400 });
  }
  const maandStart = `${maand}-01`;

  try {
    const sql = `
      SELECT
        d.id,
        ${NORM('d')} AS datum_norm,
        d.startbedrag,
        d.eindsaldo,
        (
          SELECT COUNT(*)::int
          FROM kasboek_transacties kt
          WHERE kt.dag_id = d.id
        ) AS aantal_transacties
      FROM kasboek_dagen d
      WHERE ${NORM('d')} >= $1::date
        AND ${NORM('d')} <  ($1::date + INTERVAL '1 month')
      ORDER BY ${NORM('d')} ASC
    `;
    const res = await dbQuery(sql, [maandStart]);

    return NextResponse.json(
      res.rows.map((r: any) => ({
        id: r.id,
        datum: String(r.datum_norm).slice(0, 10),
        startbedrag: r.startbedrag,
        eindsaldo: r.eindsaldo,
        aantal_transacties: r.aantal_transacties ?? 0,
      }))
    );
  } catch (e: any) {
    console.error('GET /api/kasboek/dagen error', { code: e?.code, message: e?.message });
    return NextResponse.json({ error: 'Kon dagen niet ophalen' }, { status: 500 });
  }
}

/* POST /api/kasboek/dagen  body: { datum: 'YYYY-MM-DD' }
   → idempotent; bepaalt startbedrag uit vorige dag en geeft dag terug */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const datumStr: string | null = body?.datum ? String(body.datum).slice(0, 10) : null;
  if (!datumStr) {
    return NextResponse.json({ error: 'datum (YYYY-MM-DD) is verplicht' }, { status: 400 });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const sql = `
      WITH norm_target AS ( SELECT $1::date AS target_date ),
      prev AS (
        SELECT COALESCE((
          SELECT d.eindsaldo
          FROM kasboek_dagen d
          WHERE ${NORM('d')} < (SELECT target_date FROM norm_target)
          ORDER BY ${NORM('d')} DESC
          LIMIT 1
        ), 0)::numeric(12,2) AS start
      ),
      ins AS (
        INSERT INTO kasboek_dagen (datum, startbedrag, eindsaldo)
        SELECT (SELECT target_date FROM norm_target), prev.start, prev.start
        FROM prev
        ON CONFLICT (datum) DO NOTHING
        RETURNING id, to_date(substr(datum::text,1,10),'YYYY-MM-DD') AS datum_norm, startbedrag, eindsaldo
      )
      SELECT id, datum_norm, startbedrag, eindsaldo FROM ins
      UNION ALL
      SELECT d.id,
             to_date(substr(d.datum::text,1,10),'YYYY-MM-DD') AS datum_norm,
             d.startbedrag,
             d.eindsaldo
      FROM kasboek_dagen d, norm_target nt
      WHERE ${NORM('d')} = nt.target_date
        AND NOT EXISTS (SELECT 1 FROM ins)
      LIMIT 1;
    `;
    const r = await client.query(sql, [datumStr]);

    await client.query('COMMIT');

    const row: any = r.rows[0];
    return NextResponse.json(
      {
        id: row.id,
        datum: String(row.datum_norm).slice(0, 10),
        startbedrag: row.startbedrag,
        eindsaldo: row.eindsaldo,
        aantal_transacties: 0,
      },
      { status: 201 }
    );
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('POST /api/kasboek/dagen error', e);
    return NextResponse.json({ error: 'Kon dag niet aanmaken' }, { status: 500 });
  } finally {
    client.release();
  }
}
