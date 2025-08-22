// src/app/api/rapportage/uuromzet/route.ts
import { dbRapportage } from "@/lib/dbRapportage";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isISO(d?: string | null) {
  return !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
}
function norm(d: string) {
  // sta ook DD-MM-YYYY toe
  if (/^\d{2}-\d{2}-\d{4}$/.test(d)) {
    const [dd, mm, yyyy] = d.split("-");
    return `${yyyy}-${mm}-${dd}`;
  }
  return d;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const startRaw = url.searchParams.get("start");
  const endRaw   = url.searchParams.get("end");

  if (!startRaw || !endRaw) {
    return NextResponse.json(
      { error: "Start- en einddatum zijn vereist (YYYY-MM-DD of DD-MM-YYYY)" },
      { status: 400 }
    );
  }

  const start = norm(startRaw);
  const end   = norm(endRaw);
  if (!isISO(start) || !isISO(end)) {
    return NextResponse.json(
      { error: "Datums moeten YYYY-MM-DD of DD-MM-YYYY zijn" },
      { status: 400 }
    );
  }

  try {
    // Uur-omzet uit kwartiertabel
    const { rows } = await dbRapportage.query(
      `
      SELECT
        TO_CHAR(datum, 'YYYY-MM-DD')                    AS dag,
        LPAD(uur::text, 2, '0') || ':00'               AS uur,
        ROUND(SUM(omzet))::int                          AS omzet
      FROM rapportage.omzet_kwartier
      WHERE datum BETWEEN $1 AND $2
      GROUP BY datum, uur
      ORDER BY datum, uur
      `,
      [start, end]
    );

    // Altijd een array teruggeven
    return NextResponse.json(Array.isArray(rows) ? rows : []);
  } catch (err: any) {
    console.error("[uuromzet] error:", err);
    return NextResponse.json(
      { error: "Fout bij ophalen uuromzet: " + String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
