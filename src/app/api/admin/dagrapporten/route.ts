import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const datum = searchParams.get("datum");

    if (!datum) {
      return NextResponse.json(
        { success: false, error: "Datum ontbreekt" },
        { status: 400 }
      );
    }

    const result = await db.query(
      `
      SELECT
        id,
        datum,
        dagomzet,
        weer_json,
        omzet_per_uur_json,
        haccp_json,
        productie_json,
        rotaties_json,
        rapport_json,
        html,
        gemaakt_op,
        bijgewerkt_op
      FROM dagrapporten
      WHERE datum = $1::date
      LIMIT 1
      `,
      [datum]
    );

    if (!result.rowCount) {
      return NextResponse.json({
        success: true,
        gevonden: false,
        rapport: null,
      });
    }

    const feestdagResult = await db.query(
      `
      SELECT naam
      FROM feestdagen
      WHERE datum = $1::date
      LIMIT 1
      `,
      [datum]
    );

    const specialeDatum = feestdagResult.rows[0]?.naam || null;

    return NextResponse.json({
      success: true,
      gevonden: true,
      rapport: {
        ...result.rows[0],
        speciale_datum: specialeDatum,
      },
    });
  } catch (error) {
    console.error("Fout bij ophalen dagrapport:", error);
    return NextResponse.json(
      { success: false, error: "Fout bij ophalen dagrapport" },
      { status: 500 }
    );
  }
}