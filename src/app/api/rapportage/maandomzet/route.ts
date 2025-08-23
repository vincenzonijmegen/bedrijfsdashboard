import { NextRequest, NextResponse } from "next/server";
import { dbRapportage as db } from "@/lib/dbRapportage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Row = { maand: number; omzet: number; dagen: number };

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const y = Number(url.searchParams.get("jaar") ?? new Date().getFullYear());

  try {
    // 1) OMZET per maand: MV -> fallback RAW
    const omzetByMonth = new Map<number, number>();
    {
      const mv = await db.query(
        `SELECT maand::int AS m, COALESCE(totaal,0)::numeric AS omzet
         FROM rapportage.omzet_maand
         WHERE jaar = $1`,
        [y]
      );
      if ((mv.rows ?? []).length > 0) {
        for (const r of mv.rows) omzetByMonth.set(Number(r.m), Number(r.omzet) || 0);
      } else {
        const raw = await db.query(
          `SELECT EXTRACT(MONTH FROM datum)::int AS m,
                  COALESCE(SUM(aantal*eenheidsprijs),0)::numeric AS omzet
           FROM rapportage.omzet
           WHERE EXTRACT(YEAR FROM datum)::int = $1
           GROUP BY 1`,
          [y]
        );
        for (const r of raw.rows ?? []) omzetByMonth.set(Number(r.m), Number(r.omzet) || 0);
      }
    }

    // 2) DAGEN met omzet per maand: dag×product -> fallback RAW
    const daysByMonth = new Map<number, number>();
    {
      const mv = await db.query(
        `SELECT EXTRACT(MONTH FROM datum)::int AS m,
                COUNT(DISTINCT datum)::int        AS dagen
         FROM rapportage.omzet_dag_product
         WHERE EXTRACT(YEAR FROM datum)::int = $1
         GROUP BY 1`,
        [y]
      );
      if ((mv.rows ?? []).length > 0) {
        for (const r of mv.rows) daysByMonth.set(Number(r.m), Number(r.dagen) || 0);
      } else {
        const raw = await db.query(
          `SELECT EXTRACT(MONTH FROM datum)::int AS m,
                  COUNT(DISTINCT datum)::int       AS dagen
           FROM rapportage.omzet
           WHERE EXTRACT(YEAR FROM datum)::int = $1
           GROUP BY 1`,
          [y]
        );
        for (const r of raw.rows ?? []) daysByMonth.set(Number(r.m), Number(r.dagen) || 0);
      }
    }

    // 3) Always 12 maanden teruggeven (1..12), 0 waar niets is
    const maanden: Row[] = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return {
        maand: m,
        omzet: Math.round(omzetByMonth.get(m) || 0),
        dagen: daysByMonth.get(m) || 0,
      };
    });

    return NextResponse.json({ jaar: y, maanden }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    console.error("[/api/rapportage/maandomzet] error:", e?.message ?? e);
    return NextResponse.json(
      { error: "Serverfout in maandomzet", detail: String(e?.message ?? e) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
