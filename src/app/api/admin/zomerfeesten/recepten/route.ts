import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseInit = {
  headers: {
    "Cache-Control": "no-store, max-age=0",
  },
};

export async function GET() {
  try {
    const result = await query(
      `
      SELECT
        id,
        naam,
        categorie,
        hoeveelheid_mix
      FROM keuken_recepten
      WHERE actief = true
      ORDER BY categorie ASC, naam ASC
      `
    );

    return NextResponse.json(result.rows, responseInit);
  } catch (err) {
    console.error("Fout bij ophalen keukenrecepten voor Zomerfeesten:", err);
    return NextResponse.json(
      { error: "Kon keukenrecepten niet ophalen" },
      { status: 500, ...responseInit }
    );
  }
}
