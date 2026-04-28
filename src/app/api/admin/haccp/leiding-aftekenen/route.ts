// src/app/api/admin/haccp/leiding-aftekenen/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  if (!item) return;

  const rotatieId = Number(item.rotatie_id);

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
}

async function updateHoofdritme(rotatieItemId: number) {
  const result = await db.query(
    `
    SELECT r.routine_id, r.naam
    FROM routine_rotatie_items i
    JOIN routine_rotaties r ON r.id = i.rotatie_id
    WHERE i.id = $1
    LIMIT 1
    `,
    [rotatieItemId]
  );

  const row = result.rows[0];
  if (!row) return;

  const routineId = Number(row.routine_id);
  const naam = String(row.naam);

  if (naam === "Vitrines") {
    await db.query(
      `
      UPDATE routine_rotatie_status
      SET vitrines_sinds_bewaarkast = vitrines_sinds_bewaarkast + 1,
          updated_at = NOW()
      WHERE routine_id = $1
      `,
      [routineId]
    );
  } else if (naam === "Bewaarkasten") {
    await db.query(
      `
      UPDATE routine_rotatie_status
      SET vitrines_sinds_bewaarkast = 0,
          updated_at = NOW()
      WHERE routine_id = $1
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

    // 🔍 Check of dit een rotatietaak is
    const rotatieCheck = await db.query(
      `
      SELECT rotatie_item_id, routine_id
      FROM routine_rotatie_override
      WHERE routine_id = (
        SELECT routine_id FROM routine_taken WHERE id = $1
      )
        AND datum = $2::date
      LIMIT 1
      `,
      [routineTaakId, datum]
    );

    let rotatieItemId: number | null = null;
    let routineId: number | null = null;

    if (rotatieCheck.rows[0]) {
      rotatieItemId = rotatieCheck.rows[0].rotatie_item_id;
      routineId = rotatieCheck.rows[0].routine_id;
    }

    // 🔍 Naam leidinggevende
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

    // 💾 Normale taak aftekenen
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

    // 🔁 ROTATIE meenemen
    if (rotatieItemId && routineId && status === "gedaan") {
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
        DO UPDATE SET afgetekend_op = NOW()
        `,
        [rotatieItemId, routineId, datum, naam]
      );

      await schuifRotatieItemNaarAchter(rotatieItemId);
      await updateHoofdritme(rotatieItemId);

      await db.query(
        `
        DELETE FROM routine_rotatie_override
        WHERE routine_id = $1
          AND datum = $2::date
        `,
        [routineId, datum]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fout bij leiding aftekenen:", error);

    return NextResponse.json(
      { success: false, error: "Serverfout" },
      { status: 500 }
    );
  }
}