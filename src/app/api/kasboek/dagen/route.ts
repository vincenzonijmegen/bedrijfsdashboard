import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Normalize any date/timestamp/text 'YYYY-MM-DD' to a DATE
// Works with DATE, TIMESTAMP, TEXT — no alias dependence.
const NORM = (alias: string) =>
  `to_date(substr(${alias}.datum::text, 1, 10), 'YYYY-MM-DD')`;

// Same, but for RETURNING (no table alias available)
const NORM_COL = `to_date(substr(datum::text, 1, 10), 'YYYY-MM-DD')`;

const d10 = (v: any) => (v ? String(v).slice(0, 10) : null);

// ---------- GET /api/kasboek/dagen?maand=YYYY-MM ----------
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const maand = searchParams.get('maand'); // 'YYYY-MM'
  if (!maand) {
    return NextResponse.json({ error: 'maand is verplicht (YYYY-MM)' }, { status: 400 });
  }
  // begin van maand als date
  const maandStart = `${maand}-01`;

  // Normaliseer datumkolom ongeacht type/format:
  // 1) timestamp/date -> substr(...,1,10) geeft 'YYYY-MM-DD'
  // 2) tekst in 'YYYY-MM-DD' -> match 1
  // 3) tekst in 'DD-MM-YYYY' -> fallback 2
  const NORM = (alias: string) =>
    `COALESCE(
      to_date(substr(${alias}.datum::text, 1, 10), 'YYYY-MM-DD'),
      to_date(substr(${alias}.datum::text, 1, 10), 'DD-MM-YYYY')
    )`;

  const client = await pool.connect();
  try {
    const sql = `
      SELECT
        d.id,
        ${NORM('d')} AS datum_norm,
        d.startbedrag,
        d.eindsaldo,
        COALESCE((
          SELECT COUNT(*)::int
          FROM kasboek_transacties kt
          WHERE kt.dag_id = d.id
        ), 0) AS aantal_transacties
      FROM kasboek_dagen d
      WHERE ${NORM('d')} >= $1::date
        AND ${NORM('d')} <  ($1::date + INTERVAL '1 month')
      ORDER BY ${NORM('d')} ASC
    `;
    const res = await client.query(sql, [maandStart]);

    const data = res.rows.map((r: any) => ({
      id: r.id,
      datum: String(r.datum_norm).slice(0, 10),
      startbedrag: r.startbedrag,
      eindsaldo: r.eindsaldo,
      aantal_transacties: r.aantal_transacties ?? 0,
    }));

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('GET /api/kasboek/dagen error', { code: e?.code, message: e?.message });
    return NextResponse.json({ error: 'Kon dagen niet ophalen' }, { status: 500 });
  } finally {
    client.release();
  }
}


// ---------- POST /api/kasboek/dagen  body: { datum: 'YYYY-MM-DD' } ----------
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const datumStr: string | null = body?.datum ? String(body.datum).slice(0, 10) : null;
  if (!datumStr) {
    return NextResponse.json({ error: 'datum (YYYY-MM-DD) is verplicht' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1 query die óf invoegt met juist startbedrag, óf bestaande rij teruggeeft
    const sql = `
      WITH norm_target AS (
        SELECT $1::date AS target_date
      ),
      prev AS (
        SELECT COALESCE((
          SELECT d.eindsaldo
          FROM kasboek_dagen d
          WHERE to_date(substr(d.datum::text,1,10),'YYYY-MM-DD') < (SELECT target_date FROM norm_target)
          ORDER BY to_date(substr(d.datum::text,1,10),'YYYY-MM-DD') DESC
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
      WHERE to_date(substr(d.datum::text,1,10),'YYYY-MM-DD') = nt.target_date
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
      { status: r.command === 'SELECT' ? 200 : 201 }
    );
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('POST /api/kasboek/dagen error', e);
    return NextResponse.json({ error: 'Kon dag niet aanmaken' }, { status: 500 });
  } finally {
    client.release();
  }
}

