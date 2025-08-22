import { NextResponse } from "next/server";
import { dbRapportage } from "@/lib/dbRapportage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isISO(s?: string | null) {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function toISO(d: string) {
  if (/^\d{2}-\d{2}-\d{4}$/.test(d)) {
    const [dd, mm, yyyy] = d.split("-");
    return `${yyyy}-${mm}-${dd}`;
  }
  return d;
}
function yearRange(y: number) {
  return [`${y}-01-01`, `${y}-12-31`] as const;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  const now = new Date();

  const jaarParam = url.searchParams.get("jaar");
  const startRaw  = url.searchParams.get("start") ?? url.searchParams.get("van");
  const endRaw    = url.searchParams.get("end")   ?? url.searchParams.get("tot");

  let start: string;
  let end:   string;

  try {
    // 1) Bereik bepalen (jaar of expliciete range; anders huidig jaar)
    if (jaarParam) {
      const y = Number(jaarParam);
      if (!Number.isInteger(y) || y < 2000 || y > 2100) {
        return NextResponse.json({ error: "Ongeldig jaar" }, { status: 400 });
      }
      [start, end] = yearRange(y);
    } else if (startRaw && endRaw) {
      start = toISO(startRaw);
      end   = toISO(endRaw);
      if (!isISO(start) || !isISO(end)) {
        return NextResponse.json({ error: "Datums moeten YYYY-MM-DD of DD-MM-YYYY zijn" }, { status: 400 });
      }
    } else {
      [start, end] = yearRange(now.getFullYear());
    }

    // 2) Data ophalen (LEFT JOIN zodat feestdagen zonder omzet ook terugkomen)
    const { rows } = await dbRapportage.query(
      `
      WITH f AS (
        SELECT datum::date AS datum, naam
        FROM rapportage.feestdagen
        WHERE datum BETWEEN $1 AND $2
      )
      SELECT
        f.datum::date                           AS datum,
        TO_CHAR(f.datum, 'YYYY-MM-DD')         AS dag,         -- alias tbv frontend
        f.naam                                  AS naam,
        f.naam                                  AS feestdag,    -- alias tbv frontend
        COALESCE(SUM(odp.omzet), 0)::numeric    AS omzet,
        COALESCE(SUM(odp.aantal), 0)::int       AS aantal
      FROM f
      LEFT JOIN rapportage.omzet_dag_product odp
        ON odp.datum = f.datum
      GROUP BY f.datum, f.naam
      ORDER BY f.datum, f.naam
      `,
      [start, end]
    );

    if (debug) {
      // extra checks om snel te zien waar het misgaat
      const [{ count: fdays } = { count: "0" }] = (
        await dbRapportage.query(
          `SELECT COUNT(*)::int AS count
           FROM rapportage.feestdagen
           WHERE datum BETWEEN $1 AND $2`,
          [start, end]
        )
      ).rows as any[];

      const [{ count: odp } = { count: "0" }] = (
        await dbRapportage.query(
          `SELECT COUNT(*)::int AS count
           FROM rapportage.omzet_dag_product
           WHERE datum BETWEEN $1 AND $2`,
          [start, end]
        )
      ).rows as any[];

      return NextResponse.json(
        { start, end, feestdagen_in_bereik: Number(fdays), dagproduct_rijen_in_bereik: Number(odp), data: rows },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    console.error("[feestdagomzet] error:", e?.message ?? e);
    // toon de fout (geen lege array verstoppen) zodat je het in Network ziet
    return NextResponse.json(
      { error: "Serverfout in feestdagomzet", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
