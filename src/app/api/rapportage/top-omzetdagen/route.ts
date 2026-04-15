export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { dbRapportage } from '@/lib/dbRapportage';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limitParam = Number(url.searchParams.get('limit') || '25');
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 200)
      : 25;

    const result = await dbRapportage.query(
      `
      WITH dagomzet AS (
        SELECT
          o.datum,
          ROUND(SUM(o.aantal * o.eenheidsprijs)) AS omzet
        FROM rapportage.omzet o
        GROUP BY o.datum
      ),
      feestdagen_per_dag AS (
        SELECT
          f.datum,
          STRING_AGG(f.naam, ', ' ORDER BY f.naam) AS feestdag_namen
        FROM rapportage.feestdagen f
        GROUP BY f.datum
      )
      SELECT
        TO_CHAR(d.datum, 'YYYY-MM-DD') AS datum,
        TRIM(TO_CHAR(d.datum, 'TMDay')) AS dagnaam,
        d.omzet,
        CASE
          WHEN f.feestdag_namen IS NOT NULL THEN true
          ELSE false
        END AS is_feestdag,
        f.feestdag_namen
      FROM dagomzet d
      LEFT JOIN feestdagen_per_dag f
        ON f.datum = d.datum
      ORDER BY d.omzet DESC, d.datum DESC
      LIMIT $1
      `,
      [limit]
    );

    return NextResponse.json({
      limit,
      rows: result.rows,
    });
  } catch (error) {
    console.error('API fout top omzetdagen:', error);
    return NextResponse.json(
      { error: 'Fout bij ophalen top omzetdagen' },
      { status: 500 }
    );
  }
}