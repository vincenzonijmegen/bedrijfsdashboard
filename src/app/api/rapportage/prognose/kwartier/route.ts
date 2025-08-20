// src/app/api/rapportage/profielen/kwartier/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ProfielRow = {
  maand: number; isodow: number; uur: number; kwartier: number;
  omzet_avg: string; omzet_p50: string | null; omzet_p90: string | null;
  dagomzet_avg: string | null; q_share_avg: string | null; n_samples: number;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

function parseWeekday(val: string | null): number | null {
  if (!val) return null;
  const s = val.toLowerCase();
  const map: Record<string, number> = {
    ma:1, maandag:1, mon:1, monday:1,
    di:2, dinsdag:2, tue:2, tuesday:2,
    wo:3, woensdag:3, wed:3, wednesday:3,
    do:4, donderdag:4, thu:4, thursday:4,
    vr:5, vrijdag:5, fri:5, friday:5,
    za:6, zaterdag:6, sat:6, saturday:6,
    zo:7, zondag:7, sun:7, sunday:7
  };
  if (map[s] !== undefined) return map[s];
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 && n <= 7 ? n : null;
}

function toISO(d: string) {
  const t = new Date(d + "T00:00:00Z");
  if (Number.isNaN(t.getTime())) throw new Error("Ongeldige datum: " + d);
  return t.toISOString().slice(0,10);
}

/** ---- POST: (her)bouw profiel ----
 *  Optioneel: ?from=YYYY-MM-DD&to=YYYY-MM-DD
 *  Zonder range → alles vanaf 2022.
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to   = searchParams.get("to");

    const mod = await import("@/lib/dbRapportage");
    const db  = mod.dbRapportage;

    // 1) Tabel garanderen (no-op als al bestaat)
    await db.query(`
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

    // 2) UPSERT-profiel (alleen gekozen range of alles)
    const sql = `
      WITH day_totals AS (
        SELECT o.datum::date AS datum, SUM(o.omzet) AS dag_omzet
        FROM rapportage.omzet_kwartier o
        WHERE ($1::date IS NULL OR o.datum::date >= $1::date)
          AND ($2::date IS NULL OR o.datum::date <= $2::date)
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
        WHERE ($1::date IS NULL OR o.datum::date >= $1::date)
          AND ($2::date IS NULL OR o.datum::date <= $2::date)
      )
      INSERT INTO rapportage.omzet_profiel_mw_kwartier
        (maand, isodow, uur, kwartier,
         omzet_avg, omzet_p50, omzet_p90, dagomzet_avg, q_share_avg, n_samples, last_refreshed)
      SELECT
        maand, isodow, uur, kwartier,
        AVG(omzet)                                  AS omzet_avg,
        PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY omzet) AS omzet_p50,
        PERCENTILE_DISC(0.9) WITHIN GROUP (ORDER BY omzet) AS omzet_p90,
        AVG(dag_omzet)                              AS dagomzet_avg,
        AVG(q_share)                                AS q_share_avg,
        COUNT(*)::int                               AS n_samples,
        now()                                       AS last_refreshed
      FROM quarter_rows
      GROUP BY maand, isodow, uur, kwartier
      ON CONFLICT (maand, isodow, uur, kwartier) DO UPDATE
      SET omzet_avg    = EXCLUDED.omzet_avg,
          omzet_p50    = EXCLUDED.omzet_p50,
          omzet_p90    = EXCLUDED.omzet_p90,
          dagomzet_avg = EXCLUDED.dagomzet_avg,
          q_share_avg  = EXCLUDED.q_share_avg,
          n_samples    = EXCLUDED.n_samples,
          last_refreshed = EXCLUDED.last_refreshed
    `;

    const res = await db.query(sql, [
      from ? toISO(from) : null,
      to   ? toISO(to)   : null
    ]);

    return NextResponse.json({ ok: true, upserted_groups: res.rowCount ?? 0, range: { from, to } });
  } catch (err: any) {
    console.error("build-profiel error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/** ---- GET: profiel uitlezen ----
 *  ?maand=8&weekdag=za
 *  Optioneel: &norm=100&cost_per_q=3.75 → voegt 'need_front' en 'max_front_23pct' toe.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const maand = Number(searchParams.get("maand") || "0");
    const wdStr = searchParams.get("weekdag");
    const isodow = parseWeekday(wdStr);

    if (!maand || maand < 1 || maand > 12) {
      return NextResponse.json({ ok: false, error: "Geef ?maand=1..12 mee." }, { status: 400 });
    }
    if (!isodow) {
      return NextResponse.json({ ok: false, error: "Geef ?weekdag=ma..zo of 1..7 mee." }, { status: 400 });
    }

    const norm = Number(searchParams.get("norm") || "0");        // € per medewerker per kwartier
    const costPerQ = Number(searchParams.get("cost_per_q") || "0"); // loonkosten per kwartier per medewerker

    const mod = await import("@/lib/dbRapportage");
    const db  = mod.dbRapportage;

    const sql = `
      SELECT maand, isodow, uur, kwartier,
             omzet_avg, omzet_p50, omzet_p90,
             dagomzet_avg, q_share_avg, n_samples, last_refreshed
      FROM rapportage.omzet_profiel_mw_kwartier
      WHERE maand = $1 AND isodow = $2
      ORDER BY uur, kwartier
    `;
    const rs = await db.query(sql, [maand, isodow]);
    const rows = rs.rows as ProfielRow[];

    // Optionele berekende kolommen
    let data: any[] = rows.map(r => {
      const omzetAvg = Number(r.omzet_avg);
      const out: any = {
        maand: r.maand, isodow: r.isodow, uur: r.uur, kwartier: r.kwartier,
        omzet_avg: Number(r.omzet_avg),
        omzet_p50: r.omzet_p50 ? Number(r.omzet_p50) : null,
        omzet_p90: r.omzet_p90 ? Number(r.omzet_p90) : null,
        dagomzet_avg: r.dagomzet_avg ? Number(r.dagomzet_avg) : null,
        q_share_avg: r.q_share_avg ? Number(r.q_share_avg) : null,
        n_samples: r.n_samples
      };
      if (norm > 0) {
        out.need_front = Math.ceil(omzetAvg / norm);
      }
      if (costPerQ > 0) {
        out.max_front_23pct = Math.floor((omzetAvg * 0.23) / costPerQ);
      }
      return out;
    });

    return NextResponse.json({
      ok: true,
      params: { maand, weekdag: isodow, norm, cost_per_q: costPerQ },
      count: data.length,
      data
    });
  } catch (err: any) {
    console.error("get-profiel error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
