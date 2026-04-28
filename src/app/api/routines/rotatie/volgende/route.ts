import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
const client = db;

  try {
    const body = await req.json();

    const routineId = Number(body?.routineId);
    const bodyRotatieItemId = body?.rotatieItemId
      ? Number(body.rotatieItemId)
      : null;

    if (!routineId) {
      return NextResponse.json(
        { error: "routineId verplicht" },
        { status: 400 }
      );
    }

    const vandaag = new Date().toISOString().slice(0, 10);

    await client.query("BEGIN");

    const override = await client.query(
      `
      SELECT rotatie_item_id
      FROM routine_rotatie_override
      WHERE routine_id = $1
        AND datum = $2::date
      LIMIT 1
      `,
      [routineId, vandaag]
    );

    const overrideRotatieItemId = override.rows[0]?.rotatie_item_id
      ? Number(override.rows[0].rotatie_item_id)
      : null;

    const gekozenRotatieItemId = bodyRotatieItemId || overrideRotatieItemId;

    let rotatieId: number;
    let rotatieItemId: number;

    if (gekozenRotatieItemId) {
      const gekozen = await client.query(
        `
        SELECT i.id, i.rotatie_id
        FROM routine_rotatie_items i
        JOIN routine_rotaties r ON r.id = i.rotatie_id
        WHERE i.id = $1
          AND r.routine_id = $2
          AND r.actief = true
        LIMIT 1
        `,
        [gekozenRotatieItemId, routineId]
      );

      if (!gekozen.rows[0]) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Gekozen rotatie-item niet gevonden" },
          { status: 404 }
        );
      }

      rotatieId = Number(gekozen.rows[0].rotatie_id);
      rotatieItemId = Number(gekozen.rows[0].id);
    } else {
      const rotatie = await client.query(
        `
        SELECT id, huidige_index
        FROM routine_rotaties
        WHERE routine_id = $1
          AND actief = true
        ORDER BY id ASC
        LIMIT 1
        `,
        [routineId]
      );

      if (!rotatie.rows[0]) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Rotatie niet gevonden" },
          { status: 404 }
        );
      }

      rotatieId = Number(rotatie.rows[0].id);
      const huidigeIndex = Number(rotatie.rows[0].huidige_index || 0);

      const huidigItem = await client.query(
        `
        SELECT id
        FROM routine_rotatie_items
        WHERE rotatie_id = $1
        ORDER BY sortering ASC, id ASC
        OFFSET $2
        LIMIT 1
        `,
        [rotatieId, huidigeIndex]
      );

      if (!huidigItem.rows[0]) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Geen huidig rotatie-item gevonden" },
          { status: 400 }
        );
      }

      rotatieItemId = Number(huidigItem.rows[0].id);
    }

    const items = await client.query(
      `
      SELECT id
      FROM routine_rotatie_items
      WHERE rotatie_id = $1
      ORDER BY sortering ASC, id ASC
      `,
      [rotatieId]
    );

    if (items.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Geen rotatie-items" },
        { status: 400 }
      );
    }

    const reordered = [
      ...items.rows.filter((item) => Number(item.id) !== rotatieItemId),
      ...items.rows.filter((item) => Number(item.id) === rotatieItemId),
    ];

    for (let i = 0; i < reordered.length; i++) {
      await client.query(
        `
        UPDATE routine_rotatie_items
        SET sortering = $1
        WHERE id = $2
        `,
        [(i + 1) * 10, reordered[i].id]
      );
    }

    await client.query(
      `
      UPDATE routine_rotaties
      SET huidige_index = 0
      WHERE id = $1
      `,
      [rotatieId]
    );

    await client.query(
      `
      DELETE FROM routine_rotatie_override
      WHERE routine_id = $1
        AND datum = $2::date
      `,
      [routineId, vandaag]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      rotatieId,
      rotatieItemId,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    return NextResponse.json(
      { error: "Fout bij doorschuiven", details: String(error) },
      { status: 500 }
    );
  } finally {
  }
}