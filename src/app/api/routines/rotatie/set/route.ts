import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const routineId = Number(body?.routineId);
  const rotatieItemId = body?.rotatieItemId ?? null;

  const vandaag = new Date().toISOString().slice(0, 10);

  await db.query(
    `
    INSERT INTO routine_rotatie_override (routine_id, datum, rotatie_item_id)
    VALUES ($1, $2::date, $3)
    ON CONFLICT (routine_id, datum)
    DO UPDATE SET rotatie_item_id = EXCLUDED.rotatie_item_id
    `,
    [routineId, vandaag, rotatieItemId]
  );

  return NextResponse.json({ ok: true });
}