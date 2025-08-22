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
  const now = new Date();
  const jaarParam = url.searchParams.get("jaar");
  const startRaw  = url.searchParams.get("start") ?? url.searchParams.get("van");
  const endRaw    = url.searchParams.get("end")   ?? url.searchParams.get("tot");

  let start: string;
  let end:   string;

  try {
    if (jaarParam) {
      const y = Number(jaarParam);
      if (!Number.isInteger(y) || y < 2000 || y > 2100) {
        // Onzin-jaar: geef leeg array terug i.p.v. 500
        return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
      }
      [start, end] = yearRange(y);
    } else if (startRaw && endRaw) {
      start = toISO(startRaw);
      end   = toISO(endRaw);
      if (!isISO(start) || !isISO(end)) {
        return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
      }
    } else {
      // Geen params: default naar huidig jaar
      const y = now.getFullYear();
      [start, end] = yearRange(y);
    }

    const { rows } = await dbRapportage.query(
      `
      WITH f AS (
        SELECT datum, naam
        FROM rapportage.feestdagen
        WHERE datum BETWEEN $1 AND $2
      )
      SELECT
        f.datum::date                         AS datum,
        f.naam                                AS naam,
        COALESCE(SUM(odp.omzet), 0)::numeric  AS omzet,
        COALESCE(SUM(odp.aantal), 0)::int     AS aantal
      FROM f
      LEFT JOIN rapportage.omzet_dag_product odp
        ON odp.datum = f.datum
      GROUP BY f.datum, f.naam
      ORDER BY f.datum, f.naam
      `,
      [start, end]
    );

    // Altijd array terug
    return NextResponse.json(Array.isArray(rows) ? rows : [], {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    console.error("[feestdagomzet] error:", e?.message ?? e);
    // Voor de ui: liever leeg array dan 500, zodat .map() nooit crasht
    return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
  }
}
