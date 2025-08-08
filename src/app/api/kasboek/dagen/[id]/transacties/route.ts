import { NextRequest, NextResponse } from 'next/server';
import { getClient, query as dbQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

/* GET */
export async function GET(req: NextRequest, { params }: any) {
  const dagId = Number(params?.id);
  if (!Number.isFinite(dagId)) {
    return NextResponse.json({ error: 'ongeldige dag id' }, { status: 400 });
  }
  try {
    const res = await dbQuery(
      `SELECT * FROM kasboek_transacties WHERE dag_id = $1 ORDER BY id ASC`,
      [dagId]
    );
    const rows = res.rows.map((r: any) => ({
      id: r.id,
      dag_id: r.dag_id,
      type: r.type,
      categorie: r.categorie,
      bedrag: r.bedrag,
      btw: r.btw_label ?? r.btw ?? null,
      omschrijving: r.omschrijving ?? null,
      created_at: r.created_at ?? null,
    }));
    return NextResponse.json(rows);
  } catch (e) {
    console.error('GET /kasboek/dagen/[id]/transacties error', e);
    return NextResponse.json({ error: 'Kon transacties niet ophalen' }, { status: 500 });
  }
}

/* PUT */
export async function PUT(req: NextRequest, { params }: any) {
  const dagId = Number(params?.id);
  if (!Number.isFinite(dagId)) {
    return NextResponse.json({ error: 'ongeldige dag id' }, { status: 400 });
  }

  const payload = await req.json().catch(() => null);
  if (!Array.isArray(payload)) {
    return NextResponse.json({ error: 'body moet een array met transacties zijn' }, { status: 400 });
  }

  const normBtw = (v: any): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s || s === '-' || s.toLowerCase() === 'geen') return null;
    return s.endsWith('%') ? s : `${s}%`;
  };

  // Map "overig" naar 'uitgave' (enum-veilig)
  const normType = (t: any): 'ontvangst' | 'uitgave' => (t === 'ontvangst' ? 'ontvangst' : 'uitgave');

  const rows = payload
    .map((t: any) => ({
      type: normType(t?.type),
      categorie: String(t?.categorie ?? ''),
      bedrag: Number(t?.bedrag),
      btw_label: normBtw(t?.btw ?? null),
      omschrijving: t?.omschrijving ?? null,
    }))
    .filter(
      (t) =>
        (t.type === 'ontvangst' || t.type === 'uitgave') &&
        t.categorie &&
        Number.isFinite(t.bedrag) &&
        t.bedrag >= 0
    );

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Welke btw-kolom bestaat?
    const btwColRes = await client.query<{ column_name: string }>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'kasboek_transacties'
        AND column_name IN ('btw_label','btw')
      ORDER BY CASE column_name WHEN 'btw_label' THEN 0 WHEN 'btw' THEN 1 ELSE 2 END
      LIMIT 1
      `
    );
    const btwCol: string | null = btwColRes.rows[0]?.column_name ?? null;

    // Wis bestaande
    await client.query('DELETE FROM kasboek_transacties WHERE dag_id = $1', [dagId]);

    // Insert nieuwe
    if (rows.length > 0) {
      const baseCols = ['dag_id', 'type', 'categorie', 'bedrag', 'omschrijving'];
      const cols = btwCol
        ? ['dag_id', 'type', 'categorie', 'bedrag', btwCol, 'omschrijving']
        : baseCols;

      const values: any[] = [];
      const chunks: string[] = [];
      const perRow = cols.length;

      rows.forEach((t, i) => {
        const offset = i * perRow;
        const placeholders = Array.from({ length: perRow }, (_, k) => `$${offset + k + 1}`);
        chunks.push(`(${placeholders.join(', ')})`);
        if (btwCol) {
          values.push(dagId, t.type, t.categorie, t.bedrag, t.btw_label, t.omschrijving);
        } else {
          values.push(dagId, t.type, t.categorie, t.bedrag, t.omschrijving);
        }
      });

      const insertSql = `
        INSERT INTO kasboek_transacties (${cols.join(', ')})
        VALUES ${chunks.join(', ')}
      `;
      await client.query(insertSql, values);
    }

    // eindsaldo direct bijwerken (snel)
    const sums = await client.query<{ start: number; inkomsten: number; uitgaven: number }>(
      `
      WITH s AS (
        SELECT COALESCE(startbedrag,0)::numeric AS start
        FROM kasboek_dagen
        WHERE id = $1
      ), t AS (
        SELECT
          COALESCE(SUM(CASE WHEN type='ontvangst' THEN bedrag ELSE 0 END),0)::numeric AS inkomsten,
          COALESCE(SUM(CASE WHEN type='uitgave'   THEN bedrag ELSE 0 END),0)::numeric AS uitgaven
        FROM kasboek_transacties
        WHERE dag_id = $1
      )
      SELECT s.start, t.inkomsten, t.uitgaven FROM s, t
      `,
      [dagId]
    );
    const start = Number(sums.rows[0].start);
    const inkomsten = Number(sums.rows[0].inkomsten);
    const uitgaven = Number(sums.rows[0].uitgaven);
    const eindsaldo = start + inkomsten - uitgaven;

    await client.query(
      `UPDATE kasboek_dagen SET eindsaldo = $2 WHERE id = $1`,
      [dagId, eindsaldo]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      ok: true,
      dag_id: dagId,
      inserted: rows.length,
      eindsaldo,
      inkomsten,
      uitgaven,
    });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('PUT /kasboek/dagen/[id]/transacties error', e);
    return NextResponse.json({ error: 'Kon transacties niet opslaan' }, { status: 500 });
  } finally {
    client.release();
  }
}
