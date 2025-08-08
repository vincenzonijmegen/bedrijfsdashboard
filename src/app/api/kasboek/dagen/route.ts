import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Railway/Cloud: meestal nodig
});

const d10 = (v: any) => (v ? String(v).slice(0, 10) : null);

// GET /api/kasboek/dagen?maand=YYYY-MM
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const maand = searchParams.get('maand'); // 'YYYY-MM'
  if (!maand) {
    return NextResponse.json({ error: 'maand is verplicht (YYYY-MM)' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query<{
      id: number;
      datum: string;
      startbedrag: number | null;
      eindsaldo: number | null;
      aantal_transacties: number | null;
    }>(
      `
      SELECT
        id,
        datum,
        startbedrag,
        eindsaldo,
        COALESCE(aantal_transacties, 0) AS aantal_transacties
      FROM kasboek_dagen
      WHERE TO_CHAR(datum, 'YYYY-MM') = $1
      ORDER BY datum ASC
      `,
      [maand]
    );

    const data = res.rows.map((r) => ({
      id: r.id,
      datum: d10(r.datum),
      startbedrag: r.startbedrag,
      eindsaldo: r.eindsaldo,
      aantal_transacties: Number(r.aantal_transacties ?? 0),
    }));

    return NextResponse.json(data);
  } catch (e) {
    console.error('GET /api/kasboek/dagen error', e);
    return NextResponse.json({ error: 'Kon dagen niet ophalen' }, { status: 500 });
  } finally {
    client.release();
  }
}

// POST /api/kasboek/dagen   body: { datum: 'YYYY-MM-DD' }
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const datum: string | null = body?.datum ? String(body.datum).slice(0, 10) : null;

  if (!datum) {
    return NextResponse.json({ error: 'datum (YYYY-MM-DD) is verplicht' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Bestaat al?
    const bestaand = await client.query<{
      id: number;
      datum: string;
      startbedrag: number | null;
      eindsaldo: number | null;
      aantal_transacties: number | null;
    }>(
      `SELECT id, datum, startbedrag, eindsaldo, COALESCE(aantal_transacties,0) AS aantal_transacties
       FROM kasboek_dagen
       WHERE datum = $1`,
      [datum]
    );

    if (bestaand.rows.length > 0) {
      await client.query('COMMIT');
      const r = bestaand.rows[0];
      return NextResponse.json({
        id: r.id,
        datum: d10(r.datum),
        startbedrag: r.startbedrag,
        eindsaldo: r.eindsaldo,
        aantal_transacties: Number(r.aantal_transacties ?? 0),
      });
    }

    // 2) Eindsaldo vorige dag -> startbedrag
    const prev = await client.query<{ eindsaldo: number | string | null }>(
      `SELECT eindsaldo
         FROM kasboek_dagen
        WHERE datum < $1
        ORDER BY datum DESC
        LIMIT 1`,
      [datum]
    );
    const prevRow = prev.rows[0];
    const startbedrag = prevRow ? Number(prevRow.eindsaldo ?? 0) : 0;

    // 3) Nieuw record
    const inserted = await client.query<{
      id: number;
      datum: string;
      startbedrag: number | null;
      eindsaldo: number | null;
      aantal_transacties: number | null;
    }>(
      `INSERT INTO kasboek_dagen (datum, startbedrag, eindsaldo, aantal_transacties)
       VALUES ($1, $2, $2, 0)
       RETURNING id, datum, startbedrag, eindsaldo, COALESCE(aantal_transacties,0) AS aantal_transacties`,
      [datum, startbedrag]
    );

    await client.query('COMMIT');
    const r = inserted.rows[0];
    return NextResponse.json(
      {
        id: r.id,
        datum: d10(r.datum),
        startbedrag: r.startbedrag,
        eindsaldo: r.eindsaldo,
        aantal_transacties: Number(r.aantal_transacties ?? 0),
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
