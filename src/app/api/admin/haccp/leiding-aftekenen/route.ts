// src/app/api/admin/haccp/leiding-aftekenen/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getRotatieInfo(rotatieItemId: number) {
  const result = await db.query(
    `
    SELECT i.id, i.rotatie_id, r.naam AS rotatie_naam, r.routine_id
    FROM routine_rotatie_items i
    JOIN routine_rotaties r ON r.id = i.rotatie_id
    WHERE i.id = $1
    LIMIT 1
    `,
    [rotatieItemId]
  );

  return result.rows[0] ?? null;
}

async function schuifRotatieItemNaarAchter(rotatieItemId: number) {
  const info = await getRotatieInfo(rotatieItemId);
  if (!info) return;

  const rotatieId = Number(info.rotatie_id);

  const itemsResult = await db.query(
    `
    SELECT id
    FROM routine_rotatie_items
    WHERE rotatie_id = $1
    ORDER BY sortering ASC, id ASC
    `,
    [rotatieId]
  );

  const reordered = [
    ...itemsResult.rows.filter((row) => Number(row.id) !== rotatieItemId),
    ...itemsResult.rows.filter((row) => Number(row.id) === rotatieItemId),
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
}

async function updateHoofdritme(rotatieItemId: number) {
  const info = await getRotatieInfo(rotatieItemId);
  if (!info) return;

  const routineId = Number(info.routine_id);
  const rotatieNaam = String(info.rotatie_naam);

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
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const routineTaakId = Number(body?.routineTaakId);
    const datum = String(body?.datum || "").trim();
    const leidinggevendeId = Number(body?.leidinggevendeId);
    const status = String(body?.status || "gedaan");
    const reden = String(body?.reden || "").trim();

    const isRotatieTaak = routineTaakId < 0;
    const rotatieItemId = isRotatieTaak ? Math.abs(routineTaakId) : null;

    if (!routineTaakId || !datum || !leidinggevendeId) {
      return NextResponse.json(
        { success: false, error: "Ontbrekende velden" },
        { status: 400 }
      );
    }

    if (!["gedaan", "overgeslagen"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Ongeldige status" },
        { status: 400 }
      );
    }

    if (status === "overgeslagen" && !reden) {
      return NextResponse.json(
        { success: false, error: "Reden verplicht bij overslaan" },
        { status: 400 }
      );
    }

    const leiding = await db.query(
      `
      SELECT naam
      FROM leidinggevenden
      WHERE id = $1
        AND actief = true
      LIMIT 1
      `,
      [leidinggevendeId]
    );

    if (!leiding.rowCount) {
      return NextResponse.json(
        { success: false, error: "Leidinggevende niet gevonden" },
        { status: 404 }
      );
    }

    const naam = leiding.rows[0].naam;

    if (isRotatieTaak) {
      if (!rotatieItemId) {
        return NextResponse.json(
          { success: false, error: "Rotatie-item ontbreekt" },
          { status: 400 }
        );
      }

      const info = await getRotatieInfo(rotatieItemId);

      if (!info) {
        return NextResponse.json(
          { success: false, error: "Rotatie-item niet gevonden" },
          { status: 404 }
        );
      }

      if (status === "gedaan") {
        await db.query(
          `
          INSERT INTO routine_rotatie_aftekeningen (
            rotatie_item_id,
            routine_id,
            datum,
            afgetekend_door_naam,
            afgetekend_op
          )
          VALUES ($1, $2, $3::date, $4, NOW())
          ON CONFLICT (rotatie_item_id, datum)
          DO UPDATE SET
            afgetekend_door_naam = EXCLUDED.afgetekend_door_naam,
            afgetekend_op = NOW()
          `,
          [rotatieItemId, Number(info.routine_id), datum, naam]
        );

        await schuifRotatieItemNaarAchter(rotatieItemId);
        await updateHoofdritme(rotatieItemId);

        await db.query(
          `
          DELETE FROM routine_rotatie_override
          WHERE routine_id = $1
            AND datum = $2::date
          `,
          [Number(info.routine_id), datum]
        );
      }

      return NextResponse.json({ success: true, isRotatie: true });
    }

    const existing = await db.query(
      `
      SELECT id
      FROM routine_aftekeningen
      WHERE routine_taak_id = $1
        AND datum = $2::date
      LIMIT 1
      `,
      [routineTaakId, datum]
    );

    if (existing.rowCount && existing.rows[0]?.id) {
      return NextResponse.json(
        { success: false, error: "Taak is al afgetekend" },
        { status: 400 }
      );
    }

    await db.query(
      `
      INSERT INTO routine_aftekeningen (
        routine_taak_id,
        datum,
        afgetekend_door_shiftbase_user_id,
        afgetekend_door_naam,
        afgetekend_op,
        status,
        bron,
        leidinggevende_id,
        overgeslagen_reden
      )
      VALUES (
        $1,
        $2::date,
        NULL,
        $3,
        NOW(),
        $4,
        'leiding',
        $5,
        $6
      )
      `,
      [
        routineTaakId,
        datum,
        naam,
        status,
        leidinggevendeId,
        status === "overgeslagen" ? reden : null,
      ]
    );

    return NextResponse.json({ success: true, isRotatie: false });
  } catch (error) {
    console.error("Fout bij leiding aftekenen:", error);

    return NextResponse.json(
      { success: false, error: "Serverfout" },
      { status: 500 }
    );
  }
}