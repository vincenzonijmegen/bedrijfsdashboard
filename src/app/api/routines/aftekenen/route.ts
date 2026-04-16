import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const routineTaakId = Number(body?.routineTaakId);
    const medewerkerId = String(body?.medewerkerId || "").trim();
    const medewerkerNaam = String(body?.medewerkerNaam || "").trim();
    const opmerking = body?.opmerking ? String(body.opmerking) : null;

    const isRotatie = Boolean(body?.isRotatie);
    const rotatieItemId = Number(body?.rotatieItemId);
    const routineId = Number(body?.routineId);

    const vandaag = new Date().toISOString().slice(0, 10);

    if (!medewerkerNaam) {
      return NextResponse.json(
        { error: "medewerkerNaam is verplicht" },
        { status: 400 }
      );
    }

    // ROTATIETAAK
    if (isRotatie) {
      if (!rotatieItemId || !routineId) {
        return NextResponse.json(
          { error: "rotatieItemId en routineId zijn verplicht voor rotatietaken" },
          { status: 400 }
        );
      }

      const result = await db.query(
        `INSERT INTO routine_rotatie_aftekeningen (
           rotatie_item_id,
           routine_id,
           datum,
           afgetekend_door_shiftbase_user_id,
           afgetekend_door_naam,
           afgetekend_op
         )
         VALUES ($1, $2, $3::date, $4, $5, NOW())
         ON CONFLICT (rotatie_item_id, datum)
         DO UPDATE SET
           afgetekend_door_shiftbase_user_id = EXCLUDED.afgetekend_door_shiftbase_user_id,
           afgetekend_door_naam = EXCLUDED.afgetekend_door_naam,
           afgetekend_op = NOW()
         RETURNING id, rotatie_item_id, routine_id, datum, afgetekend_door_naam, afgetekend_op`,
        [rotatieItemId, routineId, vandaag, medewerkerId || null, medewerkerNaam]
      );

      return NextResponse.json({ ok: true, aftekening: result.rows[0] });
    }

    // GEWONE TAAK
    if (!routineTaakId) {
      return NextResponse.json(
        { error: "routineTaakId is verplicht" },
        { status: 400 }
      );
    }

    const result = await db.query(
      `INSERT INTO routine_aftekeningen (
         routine_taak_id,
         datum,
         afgetekend_door_shiftbase_user_id,
         afgetekend_door_naam,
         opmerking,
         afgetekend_op
       )
       VALUES ($1, $2::date, $3, $4, $5, NOW())
       ON CONFLICT (routine_taak_id, datum)
       DO UPDATE SET
         afgetekend_door_shiftbase_user_id = EXCLUDED.afgetekend_door_shiftbase_user_id,
         afgetekend_door_naam = EXCLUDED.afgetekend_door_naam,
         opmerking = EXCLUDED.opmerking,
         afgetekend_op = NOW()
       RETURNING id, routine_taak_id, datum, afgetekend_door_naam, afgetekend_op`,
      [routineTaakId, vandaag, medewerkerId || null, medewerkerNaam, opmerking]
    );

    return NextResponse.json({ ok: true, aftekening: result.rows[0] });
  } catch (error) {
    return NextResponse.json(
      { error: "Fout bij aftekenen taak", details: String(error) },
      { status: 500 }
    );
  }
}