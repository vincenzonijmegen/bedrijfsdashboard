import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await db.query(`
      SELECT
        id,
        naam,
        COALESCE(categorie, '') AS categorie
      FROM recepten
      ORDER BY categorie NULLS LAST, naam
    `);

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Fout bij ophalen recepten voor Zomerfeesten:", err);
    return NextResponse.json(
      { error: "Kon recepten niet ophalen" },
      { status: 500 }
    );
  }
}
