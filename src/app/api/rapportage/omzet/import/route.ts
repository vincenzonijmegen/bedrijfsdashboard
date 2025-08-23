// src/app/api/rapportage/omzet/import/route.ts
import { dbRapportage } from '@/lib/dbRapportage';
import { NextResponse, NextRequest } from 'next/server';
import { refreshOmzetMaand } from '@/lib/refreshOmzetMaand';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function buildOmzetKwartieren(from: string, to: string) {
  // Verwijder oude kwartieren
  await dbRapportage.query(
    `DELETE FROM rapportage.omzet_kwartier WHERE datum BETWEEN $1 AND $2`,
    [from, to]
  );

  // Zet omzet om naar kwartierniveau
  await dbRapportage.query(`
    INSERT INTO rapportage.omzet_kwartier (datum, uur, kwartier, omzet)
    SELECT
      o.datum::date AS datum,
      EXTRACT(HOUR FROM o.tijdstip)::int AS uur,
      FLOOR(EXTRACT(MINUTE FROM o.tijdstip)::int / 15) + 1 AS kwartier,
      ROUND(SUM(o.aantal * o.eenheidsprijs)::numeric, 2) AS omzet
    FROM rapportage.omzet o
    WHERE o.datum BETWEEN $1 AND $2
    GROUP BY 1, 2, 3
  `, [from, to]);
}

async function refreshOmzetProfiel(fromISO: string, toISO: string) {
  await dbRapportage.query(`
    CREATE TABLE IF NOT EXISTS rapportage.omzet_profiel_mw_kwartier (
      maand        INT  NOT NULL CHECK (maand BETWEEN 1 AND 12),
      isodow       INT  NOT NULL CHECK (isodow BETWEEN 1 AND 7),
      uur          INT  NOT NULL CHECK (uur BETWEEN 0 AND 23),
      kwartier     INT  NOT NULL CHECK (kwartier BETWEEN 1 AND 4),
      omzet_avg    NUMERIC NOT NULL,
      omzet_p50    NUMERIC,
      omzet_p90    NUMERIC,
      dagomzet_avg NUMERIC,
      q_share_avg  NUMERIC,
      n_samples    INT     NOT NULL,
      last_refreshed timestamptz DEFAULT now(),
      PRIMARY KEY (maand, isodow, uur, kwartier)
    );
    CREATE INDEX IF NOT EXISTS idx_profiel_lookup
      ON rapportage.omzet_profiel_mw_kwartier (maand, isodow);
  `);

  const sql = `
    WITH day_totals AS (
      SELECT o.datum::date AS datum, SUM(o.omzet) AS dag_omzet
      FROM rapportage.omzet_kwartier o
      WHERE o.datum BETWEEN $1::date AND $2::date
      GROUP BY 1
    ),
    quarter_rows AS (
      SELECT
        o.datum::date AS datum,
        EXTRACT(MONTH FROM o.datum)::int   AS maand,
        EXTRACT(ISODOW FROM o.datum)::int  AS isodow,
        o.uur, o.kwartier,
        o.omzet::numeric                   AS omzet,
        dt.dag_omzet::numeric              AS dag_omzet,
        CASE WHEN dt.dag_omzet > 0 THEN (o.omzet::numeric / dt.dag_omzet::numeric) END AS q_share
      FROM rapportage.omzet_kwartier o
      JOIN day_totals dt ON dt.datum = o.datum::date
      WHERE o.datum BETWEEN $1::date AND $2::date
    )
    INSERT INTO rapportage.omzet_profiel_mw_kwartier
      (maand, isodow, uur, kwartier,
       omzet_avg, omzet_p50, omzet_p90, dagomzet_avg, q_share_avg, n_samples, last_refreshed)
    SELECT
      maand, isodow, uur, kwartier,
      AVG(omzet),
      PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY omzet),
      PERCENTILE_DISC(0.9) WITHIN GROUP (ORDER BY omzet),
      AVG(dag_omzet),
      AVG(q_share),
      COUNT(*)::int,
      now()
    FROM quarter_rows
    GROUP BY maand, isodow, uur, kwartier
    ON CONFLICT (maand, isodow, uur, kwartier) DO UPDATE
    SET omzet_avg      = EXCLUDED.omzet_avg,
        omzet_p50      = EXCLUDED.omzet_p50,
        omzet_p90      = EXCLUDED.omzet_p90,
        dagomzet_avg   = EXCLUDED.dagomzet_avg,
        q_share_avg    = EXCLUDED.q_share_avg,
        n_samples      = EXCLUDED.n_samples,
        last_refreshed = EXCLUDED.last_refreshed
  `;

  const res = await dbRapportage.query(sql, [fromISO, toISO]);
  return res.rowCount ?? 0;
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get('start');
  const eindeParam = searchParams.get('einde');

  if (!startParam || !eindeParam) {
    return NextResponse.json({ success: false, error: 'start of einde ontbreekt' }, { status: 400 });
  }

  const normalizeDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    return parts[0].length === 4 ? dateStr : `${parts[2]}-${parts[1]}-${parts[0]}`;
  };

  const isoStart = normalizeDate(startParam);
  const isoEinde = normalizeDate(eindeParam);

  const baseUrl = process.env.KASSA_API_URL!;
  const username = process.env.KASSA_USER!;
  const password = process.env.KASSA_PASS!;

  try {
    const dataUrl = `${baseUrl}?start=${encodeURIComponent(startParam)}&einde=${encodeURIComponent(eindeParam)}`;
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    const dataRes = await fetch(dataUrl, { headers: { Authorization: authHeader } });
    const rawBody = await dataRes.text();

    if (!dataRes.ok) throw new Error(`API error: ${dataRes.status} - ${rawBody}`);

    const data = JSON.parse(rawBody);
    if (!Array.isArray(data)) throw new Error('API gaf geen array terug');

    const clean = data.filter((row: any) => row.Datum && row.Tijd && row.Omschrijving && row.Aantal && row.Totaalbedrag).map((row: any) => {
      const datum = normalizeDate(row.Datum);
      const aantal = parseInt((row.Aantal || '').replace(/\D+/g, ''), 10);
      const bedrag = parseFloat((row.Totaalbedrag || '').replace(/\./g, '').replace(',', '.'));
      const prijs = aantal > 0 ? bedrag / aantal : 0;
      return { datum, tijdstip: row.Tijd, product: row.Omschrijving, aantal, eenheidsprijs: prijs };
    });

    await dbRapportage.query('DELETE FROM rapportage.omzet WHERE datum BETWEEN $1 AND $2', [isoStart, isoEinde]);

    if (clean.length === 0) {
      return NextResponse.json({ success: true, imported: 0, profiel_refresh: { skipped: true } });
    }

    const placeholders = clean.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(',');
    const values = clean.flatMap(r => [r.datum, r.tijdstip, r.product, r.aantal, r.eenheidsprijs]);

    await dbRapportage.query(
      `INSERT INTO rapportage.omzet (datum, tijdstip, product, aantal, eenheidsprijs) VALUES ${placeholders}`,
      values
    );

    await buildOmzetKwartieren(isoStart, isoEinde);

    try {
      await refreshOmzetMaand();
    } catch (e) {
      console.error('MV refresh fout (omzet_maand):', e);
    }

    let profielUpserts = 0;
    try {
      profielUpserts = await refreshOmzetProfiel(isoStart, isoEinde);
    } catch (e) {
      console.error('Profiel-refresh fout:', e);
    }

    return NextResponse.json({
      success: true,
      imported: clean.length,
      profiel_refresh: {
        range: { from: isoStart, to: isoEinde },
        upserts: profielUpserts
      }
    });
  } catch (err: any) {
    console.error('Import fout:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
