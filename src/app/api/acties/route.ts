import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET: lijst acties per lijst_id, met weekly-done logica en sortering
export async function GET(req: NextRequest) {
  const lijst_id = req.nextUrl.searchParams.get('lijst_id');
  if (!lijst_id) {
    return NextResponse.json({ error: 'lijst_id ontbreekt' }, { status: 400 });
  }

  try {
    const { rows } = await db.query(
      `
      WITH params AS (
        -- ISO-jaar/week in NL-tijd, bv. 2025W36
        SELECT to_char((now() AT TIME ZONE 'Europe/Amsterdam')::date, 'IYYY"W"IW') AS period
      )
      SELECT
        a.*,
        (COALESCE(a.recurring, 'none') = 'weekly') AS is_weekly,
        (
          COALESCE(a.recurring, 'none') = 'weekly'
          AND a.last_done_period = params.period
        ) AS done_this_week
      FROM acties a, params
      WHERE a.lijst_id = $1
      ORDER BY
        CASE
          -- behandeld als onderaan: echt voltooid of weekly al gedaan in huidige week
          WHEN a.voltooid = TRUE THEN 1
          WHEN (COALESCE(a.recurring, 'none') = 'weekly' AND a.last_done_period = params.period) THEN 1
          ELSE 0
        END,
        a.volgorde,
        a.aangemaakt_op
      `,
      [lijst_id]
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error('Fout bij ophalen acties:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}


// POST: nieuwe actie krijgt automatisch de hoogste volgorde binnen de lijst
export async function POST(req: NextRequest) {
  try {
    const { lijst_id, tekst, deadline, verantwoordelijke, recurring } = await req.json();
    if (!lijst_id || !tekst) {
      return NextResponse.json({ error: 'lijst_id en tekst zijn verplicht' }, { status: 400 });
    }

    // Bepaal hoogste volgorde binnen deze lijst
    const { rows } = await db.query(
      'SELECT COALESCE(MAX(volgorde), -1) AS max_volgorde FROM acties WHERE lijst_id = $1',
      [lijst_id]
    );
    const nieuweVolgorde = Number(rows[0].max_volgorde) + 1;

    // Recurring normaliseren (DB-check verwacht 'none' of 'weekly')
    const rec: 'none' | 'weekly' = recurring === 'weekly' ? 'weekly' : 'none';

    const resultaat = await db.query(
      `INSERT INTO acties (lijst_id, tekst, deadline, verantwoordelijke, volgorde, recurring)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [lijst_id, tekst, deadline ?? null, verantwoordelijke ?? null, nieuweVolgorde, rec]
    );

    return NextResponse.json(resultaat.rows[0]);
  } catch (err) {
    console.error('Fout bij toevoegen actie:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// PATCH: update actie (tekst, voltooid, volgorde, recurring)
export async function PATCH(req: NextRequest) {
  try {
    const { id, tekst, voltooid, volgorde, recurring } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'id ontbreekt' }, { status: 400 });
    }

    const sets: string[] = [];
    const params: any[] = [id];
    let paramIdx = 2;

    if (typeof tekst !== 'undefined') {
      sets.push(`tekst = $${paramIdx++}`);
      params.push(tekst);
    }
    if (typeof voltooid !== 'undefined') {
      sets.push(`voltooid = $${paramIdx++}`);
      params.push(voltooid);
    }
    if (typeof volgorde !== 'undefined') {
      sets.push(`volgorde = $${paramIdx++}`);
      params.push(volgorde);
    }
    if (typeof recurring !== 'undefined') {
      if (recurring !== 'weekly' && recurring !== 'none') {
        return NextResponse.json({ error: "recurring moet 'weekly' of 'none' zijn" }, { status: 400 });
      }
      sets.push(`recurring = $${paramIdx++}`);
      params.push(recurring);
      // NB: last_done_period laten we ongemoeid; bij 'none' wordt het toch genegeerd.
    }

    if (!sets.length) {
      return NextResponse.json({ error: 'Geen velden om bij te werken' }, { status: 400 });
    }

    const sql = `UPDATE acties SET ${sets.join(', ')} WHERE id = $1 RETURNING *`;
    const resultaat = await db.query(sql, params);

    if (resultaat.rows.length === 0) {
      return NextResponse.json({ error: 'Actie niet gevonden' }, { status: 404 });
    }
    return NextResponse.json(resultaat.rows[0]);
  } catch (err) {
    console.error('Fout in PATCH /api/acties:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

// DELETE: verwijder actie
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'id ontbreekt' }, { status: 400 });
    }
    const controle = await db.query('SELECT id FROM acties WHERE id = $1', [id]);
    if (controle.rowCount === 0) {
      return NextResponse.json({ error: 'Actie niet gevonden' }, { status: 404 });
    }
    await db.query('DELETE FROM acties WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Fout bij verwijderen actie:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
