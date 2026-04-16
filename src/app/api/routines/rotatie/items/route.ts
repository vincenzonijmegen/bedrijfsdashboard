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

    const rotatie = await db.query(
      `SELECT id
       FROM routine_rotaties
       WHERE routine_id = $1 AND actief = true
       LIMIT 1`,
      [routineId]
    );

    if (!rotatie.rows[0]) {
      return NextResponse.json({ items: [] });
    }

    const items = await db.query(
      `SELECT id, naam, sortering
       FROM routine_rotatie_items
       WHERE rotatie_id = $1
       ORDER BY sortering ASC`,
      [rotatie.rows[0].id]
    );

    return NextResponse.json({ items: items.rows });
  } catch (error) {
    return NextResponse.json(
      { error: "Fout bij ophalen rotatie-items", details: String(error) },
      { status: 500 }
    );
  }
}