import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

async function schuifRotatieItemNaarAchter(rotatieItemId: number) {
  const itemResult = await db.query(
    `
    SELECT i.id, i.rotatie_id, r.naam AS rotatie_naam, r.routine_id
    FROM routine_rotatie_items i
    JOIN routine_rotaties r ON r.id = i.rotatie_id
    WHERE i.id = $1
    LIMIT 1
    `,
    [rotatieItemId]
  );

  const item = itemResult.rows[0];

  if (!item) {
    throw new Error("Rotatie-item niet gevonden");
  }

  const rotatieId = Number(item.rotatie_id);
  const routineId = Number(item.routine_id);
  const rotatieNaam = String(item.rotatie_naam);

  const itemsResult = await db.query(
    `
    SELECT id
    FROM routine_rotatie_items
    WHERE rotatie_id = $1
    ORDER BY sortering ASC, id ASC
    `,
    [rotatieId]
  );

  const items = itemsResult.rows;

  const reordered = [
    ...items.filter((row) => Number(row.id) !== rotatieItemId),
    ...items.filter((row) => Number(row.id) === rotatieItemId),
  ];

  for (let i = 0; i < reordered.length; i++) {
    await db.query(
      `
      UPDATE routine_rotatie_items
      SET sortering = $1
      WHERE id = $2
      `,
      [(i + 1) * 10, reordered[i].id]
    );
  }

  await db.query(
    `
    UPDATE routine_rotaties
    SET huidige_index = 0
    WHERE id = $1
    `,
    [rotatieId]
  );

  return { rotatieId, routineId, rotatieNaam };
}

async function updateHoofdritmeStatus(routineId: number, rotatieNaam: string) {
  if (rotatieNaam === "Bewaarkasten") {
    await db.query(
      `
      INSERT INTO routine_rotatie_status (
        routine_id,
        vitrines_sinds_bewaarkast,
        updated_at
      )
      VALUES ($1, 0, NOW())
      ON CONFLICT (routine_id)
      DO UPDATE SET
        vitrines_sinds_bewaarkast = 0,
        updated_at = NOW()
      `,
      [routineId]
    );

    return;
  }

  if (rotatieNaam === "Vitrines") {
    await db.query(
      `
      INSERT INTO routine_rotatie_status (
        routine_id,
        vitrines_sinds_bewaarkast,
        updated_at
      )
      VALUES ($1, 1, NOW())
      ON CONFLICT (routine_id)
      DO UPDATE SET
        vitrines_sinds_bewaarkast = LEAST(
          routine_rotatie_status.vitrines_sinds_bewaarkast + 1,
          3
        ),
        updated_at = NOW()
      `,
      [routineId]
    );
  }
}

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

    if (isRotatie) {
      if (!rotatieItemId || !routineId) {
        return NextResponse.json(
          {
            error:
              "rotatieItemId en routineId zijn verplicht voor rotatietaken",
          },
          { status: 400 }
        );
      }

      const result = await db.query(
        `
        INSERT INTO routine_rotatie_aftekeningen (
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
        RETURNING id, rotatie_item_id, routine_id, datum, afgetekend_door_naam, afgetekend_op
        `,
        [rotatieItemId, routineId, vandaag, medewerkerId || null, medewerkerNaam]
      );

      const rotatieInfo = await schuifRotatieItemNaarAchter(rotatieItemId);

      await updateHoofdritmeStatus(
        rotatieInfo.routineId,
        rotatieInfo.rotatieNaam
      );

      await db.query(
        `
        DELETE FROM routine_rotatie_override
        WHERE routine_id = $1
          AND datum = $2::date
        `,
        [routineId, vandaag]
      );

      return NextResponse.json({
        ok: true,
        aftekening: result.rows[0],
        rotatieDoorgeschoven: true,
        rotatieId: rotatieInfo.rotatieId,
        rotatieNaam: rotatieInfo.rotatieNaam,
        rotatieItemId,
      });
    }

    if (!routineTaakId) {
      return NextResponse.json(
        { error: "routineTaakId is verplicht" },
        { status: 400 }
      );
    }

    const result = await db.query(
      `
      INSERT INTO routine_aftekeningen (
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
      RETURNING id, routine_taak_id, datum, afgetekend_door_naam, afgetekend_op
      `,
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