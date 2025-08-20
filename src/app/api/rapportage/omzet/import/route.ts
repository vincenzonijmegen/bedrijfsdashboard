// src/app/api/rapportage/omzet/import/route.ts
import { dbRapportage } from '@/lib/dbRapportage';
import { NextResponse, NextRequest } from 'next/server';
import { refreshOmzetMaand } from '@/lib/refreshOmzetMaand';

// Voor zelf-ondertekende certificaten (NIET aanbevolen voor productie)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ---- Kleine helper: (her)bouw profiel-tabel voor een datumrange ----
async function refreshOmzetProfiel(fromISO: string, toISO: string) {
  // Tabel garanderen
  await dbRapportage.query(`
    CREATE TABLE IF NOT EXISTS rapportage.omzet_profiel_mw_kwartier (
      maand        INT  NOT NULL CHECK (maand BETWEEN 1 AND 12),
      isodow       INT  NOT NULL CHECK (isodow BETWEEN 1 AND 7),   -- 1=ma ... 7=zo
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

  // UPSERT op basis van kwartiertabel (alleen gekozen range)
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
        CASE WHEN dt.dag_omzet > 0
             THEN (o.omzet::numeric / dt.dag_omzet::numeric)
        END AS q_share
      FROM rapportage.omzet_kwartier o
      JOIN day_totals dt ON dt.datum = o.datum::date
      WHERE o.datum BETWEEN $1::date AND $2::date
    )
    INSERT INTO rapportage.omzet_profiel_mw_kwartier
      (maand, isodow, uur, kwartier,
       omzet_avg, omzet_p50, omzet_p90, dagomzet_avg, q_share_avg, n_samples, last_refreshed)
    SELECT
      maand, isodow, uur, kwartier,
      AVG(omzet)                                        AS omzet_avg,
      PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY omzet) AS omzet_p50,
      PERCENTILE_DISC(0.9) WITHIN GROUP (ORDER BY omzet) AS omzet_p90,
      AVG(dag_omzet)                                    AS dagomzet_avg,
      AVG(q_share)                                      AS q_share_avg,
      COUNT(*)::int                                     AS n_samples,
      now()                                             AS last_refreshed
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

  console.log('Import start parameters:', { startParam, eindeParam });
  if (!startParam || !eindeParam) {
    console.error('Ontbrekende start of einde parameter');
    return NextResponse.json(
      { success: false, error: 'start of einde ontbreekt' },
      { status: 400 }
    );
  }

  // Normalizeer DD-MM-YYYY of ISO YYYY-MM-DD naar YYYY-MM-DD
  const normalizeDate = (dateStr: string) => {
    const parts = dateStr.split('-').map((s) => s.padStart(2, '0'));
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1]}-${parts[2]}`;
    }
    const [d, m, y] = parts;
    return `${y}-${m}-${d}`;
  };
  const isoStart = normalizeDate(startParam);
  const isoEinde = normalizeDate(eindeParam);

  const baseUrl = process.env.KASSA_API_URL!;
  const username = process.env.KASSA_USER!;
  const password = process.env.KASSA_PASS!;

  try {
    // Ophalen van de data met Basic Auth
    const dataUrl = `${baseUrl}?start=${encodeURIComponent(startParam)}&einde=${encodeURIComponent(eindeParam)}`;
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    console.log('Fetching data from:', dataUrl);

    const dataRes = await fetch(dataUrl, { headers: { Authorization: authHeader } });
    const rawBody = await dataRes.text();
    const contentType = dataRes.headers.get('content-type') || '';

    console.log('Response status:', dataRes.status, 'Content-Type:', contentType);
    if (!dataRes.ok) {
      console.error('Fetch failed:', dataRes.status, rawBody);
      throw new Error(`API error: ${dataRes.status}`);
    }
    if (!contentType.includes('application/json')) {
      console.error('Ongeldig content-type:', contentType, rawBody);
      throw new Error('Ongeldig antwoord van API: geen JSON');
    }

    const data = JSON.parse(rawBody);
    if (!Array.isArray(data)) {
      console.error('Verwachte array, kreeg:', data);
      throw new Error('API returned geen array');
    }
    console.log('Gedecodeerde items:', data.length);

    // Filter en parse records, bereken eenheidsprijs als totaalbedrag / aantal
    const clean = data
      .filter((row: any) => row.Datum && row.Tijd && row.Omschrijving && row.Aantal && row.Totaalbedrag)
      .map((row: any) => {
        const datum = normalizeDate(row.Datum as string);
        const aantal = parseInt((row.Aantal as string).replace(/\D+/g, ''), 10);
        const totaalBedrag = parseFloat((row.Totaalbedrag as string).replace(/\./g, '').replace(',', '.'));
        const eenheidsprijs = aantal > 0 ? totaalBedrag / aantal : 0;
        return {
          datum,
          tijdstip: row.Tijd as string,
          product: row.Omschrijving as string,
          aantal,
          eenheidsprijs,
        };
      });

    // Verwijder bestaande data in de range
    console.log('Verwijder oude records van', isoStart, 'tot', isoEinde);
    await dbRapportage.query(
      'DELETE FROM rapportage.omzet WHERE datum BETWEEN $1 AND $2',
      [isoStart, isoEinde]
    );

    if (clean.length === 0) {
      console.log('Geen nieuwe records om in te voegen');
      // MV hoeft niet ge-refreshed: er is niets veranderd
      return NextResponse.json({ success: true, imported: 0, profiel_refresh: { skipped: true } });
    }

    // Bulk insert
    console.log('Invoegen van', clean.length, 'records');
    const placeholders: string[] = [];
    const values: any[] = [];
    clean.forEach((item, idx) => {
      const off = idx * 5;
      placeholders.push(`($${off + 1}, $${off + 2}, $${off + 3}, $${off + 4}, $${off + 5})`);
      values.push(item.datum, item.tijdstip, item.product, item.aantal, item.eenheidsprijs);
    });
    const insertSQL = `
      INSERT INTO rapportage.omzet (datum, tijdstip, product, aantal, eenheidsprijs)
      VALUES ${placeholders.join(',')}
    `;
    await dbRapportage.query(insertSQL, values);

    // (Optioneel) materialized view refresh (bestaand gedrag)
    try {
      await refreshOmzetMaand();
    } catch (e) {
      console.error('MV refresh fout (omzet_maand):', e);
      // Niet laten falen; rapportage is hooguit een import achter
    }

    // ---- NIEUW: Profiel-refresh hook (maand×weekdag×kwartier) op basis van kwartiertabel ----
    // Let op: dit veronderstelt dat je kwartiertabel up-to-date is. Als je die in je importflow ook opbouwt,
    // roep dat VOOR deze stap aan.
    let profielUpserts = 0;
    try {
      profielUpserts = await refreshOmzetProfiel(isoStart, isoEinde);
      console.log(`Profiel (mw×kwartier) geüpdatet voor range ${isoStart}..${isoEinde}: ${profielUpserts} rows`);
    } catch (e) {
      console.error('Profiel-refresh fout:', e);
      // Niet laten falen; import blijft succesvol
    }

    console.log('Import geslaagd');
    return NextResponse.json({
      success: true,
      imported: clean.length,
      profiel_refresh: { range: { from: isoStart, to: isoEinde }, upserts: profielUpserts }
    });
  } catch (err: any) {
    console.error('Import fout:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
