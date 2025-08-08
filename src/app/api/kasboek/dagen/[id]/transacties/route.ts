import { NextResponse } from 'next/server';
import { getClient, query as dbQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

// -------- GET /api/kasboek/dagen/[id]/transacties --------
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const dagId = Number(params.id);
  if (!Number.isFinite(dagId)) {
    return NextResponse.json({ error: 'ongeldige dag id' }, { status: 400 });
  }

  try {
    const sql = `
      SELECT id, dag_id, type, categorie, bedrag, btw_label AS btw, omschrijving, created_at
      FROM kasboek_transacties
      WHERE dag_id = $1
      ORDER BY id ASC
    `;
    const res = await dbQuery(sql, [dagId]);
    return NextResponse.json(res.rows);
  } catch (e) {
    console.error('GET /kasboek/dagen/[id]/transacties error', e);
    return NextResponse.json({ error: 'Kon transacties niet ophalen' }, { status: 500 });
  }
}

// -------- PUT /api/kasboek/dagen/[id]/transacties --------
// Body: Array<{ type:'ontvangst'|'uitgave'|'overig', categorie:string, bedrag:number, btw?:string|null, omschrijving?:string|null }>
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const dagId = Number(params.id);
  if (!Number.isFinite(dagId)) {
    return NextResponse.json({ error: 'ongeldige dag id' }, { status: 400 });
  }

  const payload = await req.json().catch(() => null);
  if (!Array.isArray(payload)) {
    return NextResponse.json({ error: 'body moet een array met transacties zijn' }, { status: 400 });
  }

  const rows = payload
    .map((t: any) => {
      const s = (v: any) => (v == null ? null : String(v).trim());
      const lbl = s(t?.btw);
      const btw =
        lbl == null || lbl === '' || lbl === '-' || lbl.toLowerCase() === 'geen'
          ? null
          : lbl.endsWith('%')
          ? lbl
          : `${lbl}%`;
      return {
        type: t?.type,
        categorie: String(t?.categorie ?? ''),
        bedrag: Number(t?.bedrag),
        btw_label: btw as string | null,
        omschrijving: t?.omschrijving ?? null,
      };
    })
    .filter(
      (t) =>
        (t.type === 'ontvangst' || t.type === 'uitgave' || t.type === 'overig') &&
        t.categorie &&
        Number.isFinite(t.bedrag) &&
        t.bedrag >= 0
    );

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1) wis bestaande transacties van de dag
    await client.query('DELETE FROM kasboek_transacties WHERE dag_id = $1', [dagId]);

    // 2) herinsert in bulk
    if (rows.length > 0) {
      const values: any[] = [];
      const chunks: string[] = [];
      rows.forEach((t, i) => {
        const base = i * 6;
        chunks.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`);
        values.push(dagId, t.type, t.categorie, t.bedrag, t.btw_label, t.omschrijving);
      });

      const insertSql = `
        INSERT INTO kasboek_transacties
          (dag_id, type, categorie, bedrag, btw_label, omschrijving)
        VALUES ${chunks.join(', ')}
      `;
      await client.query(insertSql, values);
    }

    // 3) eindsaldo herberekenen (start + ontvangsten − uitgaven)
    const s = await client.query<{ startbedrag: string | number }>(
      `SELECT startbedrag FROM kasboek_dagen WHERE id = $1`,
      [dagId]
    );
    const start = Number(s.rows?.[0]?.startbedrag ?? 0);

    const sums = await client.query<{ inkomsten: number; uitgaven: number }>(
      `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'ontvangst' THEN bedrag ELSE 0 END), 0)::numeric AS inkomsten,
        COALESCE(SUM(CASE WHEN type = 'uitgave'   THEN bedrag ELSE 0 END), 0)::numeric AS uitgaven
      FROM kasboek_transacties
      WHERE dag_id = $1
      `,
      [dagId]
    );
    const inkomsten = Number(sums.rows[0].inkomsten || 0);
    const uitgaven = Number(sums.rows[0].uitgaven || 0);
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
