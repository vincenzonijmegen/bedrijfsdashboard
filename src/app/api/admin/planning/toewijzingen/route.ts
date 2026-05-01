import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const periode_id = req.nextUrl.searchParams.get("periode_id");

    if (!periode_id) {
      return NextResponse.json(
        { success: false, error: "periode_id ontbreekt" },
        { status: 400 }
      );
    }

    const { rows } = await db.query(
      `
      SELECT
        t.id,
        t.datum,
        t.shift_nr,
        t.functie,
        t.medewerker_email,
        m.naam
      FROM planning_toewijzingen t
      JOIN medewerkers m ON m.email = t.medewerker_email
      WHERE t.periode_id = $1
      ORDER BY t.datum, t.shift_nr, t.functie, m.naam
      `,
      [periode_id]
    );

    return NextResponse.json({ success: true, items: rows });
  } catch (error) {
    console.error("Fout bij ophalen planning:", error);
    return NextResponse.json(
      { success: false, error: "Ophalen planning mislukt" },
      { status: 500 }
    );
  }
}