// src/app/api/rapportage/weekrapport/route.ts

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getPreviousSundayToSaturday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const day = today.getDay(); // zondag = 0
  const afgelopenZondag = new Date(today);
  afgelopenZondag.setDate(today.getDate() - day - 7);

  const afgelopenZaterdag = new Date(afgelopenZondag);
  afgelopenZaterdag.setDate(afgelopenZondag.getDate() + 6);

  return {
    startDatum: formatDateOnly(afgelopenZondag),
    eindDatum: formatDateOnly(afgelopenZaterdag),
  };
}

export async function GET() {
  try {
    const { startDatum, eindDatum } = getPreviousSundayToSaturday();

    const omzetResult = await db.query(
      `
      SELECT
        datum::date AS datum,
        ROUND(SUM(aantal * eenheidsprijs)) AS omzet
      FROM rapportage.omzet
      WHERE datum >= $1::date
        AND datum <= $2::date
      GROUP BY datum::date
      ORDER BY datum::date ASC
      `,
      [startDatum, eindDatum]
    );

    const dagen = omzetResult.rows.map((row) => ({
      datum: row.datum.toISOString().slice(0, 10),
      omzet: Number(row.omzet || 0),
    }));

    const totaalOmzet = dagen.reduce((sum, dag) => sum + dag.omzet, 0);
    const gemiddeldeOmzet = dagen.length ? Math.round(totaalOmzet / dagen.length) : 0;
    const besteDag = [...dagen].sort((a, b) => b.omzet - a.omzet)[0] || null;

    return NextResponse.json({
      success: true,
      startDatum,
      eindDatum,
      dagen,
      totaalOmzet,
      gemiddeldeOmzet,
      besteDag,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Fout bij ophalen weekrapport", details: String(error) },
      { status: 500 }
    );
  }
}