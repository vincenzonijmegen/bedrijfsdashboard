import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const routineId = Number(req.nextUrl.searchParams.get("routineId"));

    if (!routineId) {
      return NextResponse.json(
        { error: "routineId verplicht" },
        { status: 400 }
      );
    }

    const items = await db.query(
      `
      SELECT
        i.id,
        i.naam,
        i.sortering,
        i.rotatie_id AS "rotatieId",
        r.naam AS "rotatieNaam"
      FROM routine_rotaties r
      JOIN routine_rotatie_items i ON i.rotatie_id = r.id
      WHERE r.routine_id = $1
        AND r.actief = true
      ORDER BY r.id ASC, i.sortering ASC, i.id ASC
      `,
      [routineId]
    );

    return NextResponse.json({ items: items.rows });
  } catch (error) {
    return NextResponse.json(
      { error: "Fout bij ophalen rotatie-items", details: String(error) },
      { status: 500 }
    );
  }
}