import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const routineId = Number(body?.routineId);

    if (!routineId) {
      return NextResponse.json({ error: "routineId verplicht" }, { status: 400 });
    }

    const rotatie = await db.query(
      `SELECT id, huidige_index
       FROM routine_rotaties
       WHERE routine_id = $1 AND actief = true
       LIMIT 1`,
      [routineId]
    );

    if (!rotatie.rows[0]) {
      return NextResponse.json({ error: "Rotatie niet gevonden" }, { status: 404 });
    }

    const r = rotatie.rows[0];

    const items = await db.query(
      `SELECT id FROM routine_rotatie_items
       WHERE rotatie_id = $1
       ORDER BY sortering ASC`,
      [r.id]
    );

    const count = items.rows.length;
    if (count === 0) {
      return NextResponse.json({ error: "Geen rotatie-items" }, { status: 400 });
    }

    const nieuweIndex = (r.huidige_index + 1) % count;

    await db.query(
      `UPDATE routine_rotaties
       SET huidige_index = $1
       WHERE id = $2`,
      [nieuweIndex, r.id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Fout bij doorschuiven", details: String(error) },
      { status: 500 }
    );
  }
}