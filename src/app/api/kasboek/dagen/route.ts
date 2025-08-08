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
  const maandStart = `${maand}-01`;

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
      WHERE date_trunc('month', ${NORM('d')}) = date_trunc('month', $1::date)
      ORDER BY ${NORM('d')} ASC
    `;
    const res = await client.query(sql, [maandStart]);

    const data = res.rows.map((r: any) => ({
      id: r.id,
      datum: d10(r.datum_norm),
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

    // Bestaat al? Vergelijk op genormaliseerde DATE
    const selectBestaat = `
      SELECT
        d.id,
        ${NORM('d')} AS datum_norm,
        d.startbedrag,
        d.eindsaldo
      FROM kasboek_dagen d
      WHERE ${NORM('d')} = $1::date
      LIMIT 1
    `;
    const bestaand = await client.query(selectBestaat, [datumStr]);

    if (bestaand.rows.length > 0) {
      await client.query('COMMIT');
      const r: any = bestaand.rows[0];
      return NextResponse.json({
        id: r.id,
        datum: d10(r.datum_norm),
        startbedrag: r.startbedrag,
        eindsaldo: r.eindsaldo,
        aantal_transacties: 0,
      });
    }

    // Eindsaldo vorige dag
    const selectPrev = `
      SELECT d.eindsaldo
      FROM kasboek_dagen d
      WHERE ${NORM('d')} < $1::date
      ORDER BY ${NORM('d')} DESC
      LIMIT 1
    `;
    const prev = await client.query(selectPrev, [datumStr]);
    const prevRow = prev.rows[0];
    const startbedrag = prevRow ? Number(prevRow.eindsaldo ?? 0) : 0;

    // Insert en RETURNING (alias-loos variant)
    const insertSql = `
      INSERT INTO kasboek_dagen (datum, startbedrag, eindsaldo)
      VALUES ($1::date, $2, $2)
      RETURNING id, ${NORM_COL} AS datum_norm, startbedrag, eindsaldo
    `;
    const inserted = await client.query(insertSql, [datumStr, startbedrag]);

    await client.query('COMMIT');
    const r: any = inserted.rows[0];
    return NextResponse.json(
      {
        id: r.id,
        datum: d10(r.datum_norm),
        startbedrag: r.startbedrag,
        eindsaldo: r.eindsaldo,
        aantal_transacties: 0,
      },
      { status: 201 }
    );
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('POST /api/kasboek/dagen error', e);
    return NextResponse.json({ error: 'Kon dag niet aanmaken' }, { status: 500 });
  } finally {
    client.release();
  }
}
