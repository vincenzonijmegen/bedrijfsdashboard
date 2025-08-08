import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Normaliseer naar DATE zonder errors, ongeacht kolomtype (date/timestamp/text)
const DATE_EXPR = `
CASE
  WHEN pg_typeof(d.datum)::text = 'date' THEN d.datum
  WHEN pg_typeof(d.datum)::text LIKE 'timestamp%' THEN d.datum::date
  ELSE to_date(d.datum::text, 'YYYY-MM-DD')
END
`;

// slice naar YYYY-MM-DD voor response
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
        ${DATE_EXPR}       AS datum_norm,     -- altijd een DATE
        d.startbedrag,
        d.eindsaldo,
        COALESCE((
          SELECT COUNT(*)::int
          FROM kasboek_transacties kt
          WHERE kt.dag_id = d.id
        ), 0) AS aantal_transacties
      FROM kasboek_dagen d
      WHERE date_trunc('month', ${DATE_EXPR}) = date_trunc('month', $1::date)
      ORDER BY ${DATE_EXPR} ASC
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

    // Bestaat al? Vergelijk altijd op de genormaliseerde DATE
    const selectBestaat = `
      SELECT
        d.id,
        ${DATE_EXPR} AS datum_norm,
        d.startbedrag,
        d.eindsaldo
      FROM kasboek_dagen d
      WHERE ${DATE_EXPR} = $1::date
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

    // Eindsaldo vorige dag (op basis van genormaliseerde DATE)
    const selectPrev = `
      SELECT d.eindsaldo
      FROM kasboek_dagen d
      WHERE ${DATE_EXPR} < $1::date
      ORDER BY ${DATE_EXPR} DESC
      LIMIT 1
    `;
    const prev = await client.query(selectPrev, [datumStr]);
    const prevRow = prev.rows[0];
    const startbedrag = prevRow ? Number(prevRow.eindsaldo ?? 0) : 0;

    // Invoegen — laat DB kolomtype zijn werk doen:
    // - als d.datum DATE is, casten we naar date
    // - is d.datum TEXT, dan kun je ook plain string inserten; date cast is veiliger
    const insertSql = `
      INSERT INTO kasboek_dagen (datum, startbedrag, eindsaldo)
      VALUES ($1::date, $2, $2)
      RETURNING id, ${DATE_EXPR} AS datum_norm, startbedrag, eindsaldo
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
