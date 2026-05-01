import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET → haal alles op voor een periode
 */
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
        datum,
        shift_nr,
        functie,
        aantal
      FROM planning_shiftbehoefte
      WHERE periode_id = $1
      ORDER BY datum, shift_nr, functie
      `,
      [periode_id]
    );

    return NextResponse.json({ success: true, items: rows });
  } catch (error) {
    console.error("Fout bij ophalen shiftbehoefte:", error);
    return NextResponse.json(
      { success: false, error: "Ophalen mislukt" },
      { status: 500 }
    );
  }
}

/**
 * POST → bulk opslaan (alles in één keer)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const periode_id = body.periode_id;
    const items = body.items as {
      datum: string;
      shift_nr: number;
      functie: "scheppen" | "voorbereiden" | "ijsbereiden";
      aantal: number;
    }[];

    if (!periode_id || !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, error: "Ongeldige input" },
        { status: 400 }
      );
    }

    // eerst alles weggooien → daarna opnieuw opslaan
    await db.query(
      `DELETE FROM planning_shiftbehoefte WHERE periode_id = $1`,
      [periode_id]
    );

    for (const item of items) {
      await db.query(
        `
        INSERT INTO planning_shiftbehoefte
        (periode_id, datum, shift_nr, functie, aantal)
        VALUES ($1, $2::date, $3, $4, $5)
        `,
        [
          periode_id,
          item.datum,
          item.shift_nr,
          item.functie,
          item.aantal,
        ]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fout bij opslaan shiftbehoefte:", error);
    return NextResponse.json(
      { success: false, error: "Opslaan mislukt" },
      { status: 500 }
    );
  }
}