import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getOrCreateMaaklijstId(datum: string, locatie: string) {
  const existing = await db.query(
    `
    SELECT id
    FROM maaklijsten
    WHERE datum = $1::date
      AND locatie = $2
    LIMIT 1
    `,
    [datum, locatie]
  );

  if (existing.rowCount && existing.rows[0]?.id) {
    return Number(existing.rows[0].id);
  }

  const created = await db.query(
    `
    INSERT INTO maaklijsten (datum, locatie, status)
    VALUES ($1::date, $2, 'open')
    RETURNING id
    `,
    [datum, locatie]
  );

  return Number(created.rows[0].id);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const datum =
      String(body?.datum || "").trim() ||
      new Date().toISOString().slice(0, 10);

    const locatie = String(body?.locatie || "keuken").trim();
    const receptId = Number(body?.recept_id);
    const categorie = String(body?.categorie || "").trim();
    const naam = String(body?.naam || "").trim();
    const maakvolgorde = Number(body?.maakvolgorde ?? 50);
    const aantal = Math.max(1, Number(body?.aantal ?? 1));

    if (!receptId || !categorie || !naam) {
      return NextResponse.json(
        { success: false, error: "recept_id, categorie en naam zijn verplicht" },
        { status: 400 }
      );
    }

    const maaklijstId = await getOrCreateMaaklijstId(datum, locatie);

    const existing = await db.query(
      `
      SELECT id, aantal
      FROM maaklijst_items
      WHERE maaklijst_id = $1
        AND recept_id = $2
      LIMIT 1
      `,
      [maaklijstId, receptId]
    );

    let result;

    if (existing.rowCount && existing.rows[0]?.id) {
      result = await db.query(
        `
        UPDATE maaklijst_items
        SET
          aantal = aantal + $1,
          status = 'open',
          bijgewerkt_op = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [aantal, existing.rows[0].id]
      );
    } else {
      result = await db.query(
        `
        INSERT INTO maaklijst_items
          (maaklijst_id, recept_id, categorie, naam, maakvolgorde, aantal, status)
        VALUES
          ($1, $2, $3, $4, $5, $6, 'open')
        RETURNING *
        `,
        [maaklijstId, receptId, categorie, naam, maakvolgorde, aantal]
      );
    }

    await db.query(
      `
      UPDATE maaklijsten
      SET bijgewerkt_op = NOW()
      WHERE id = $1
      `,
      [maaklijstId]
    );

    return NextResponse.json({
      success: true,
      item: result.rows[0],
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Fout bij toevoegen aan maaklijst", details: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    const id = Number(body?.id);
    const status = body?.status;
    const aantal =
      body?.aantal === undefined || body?.aantal === null
        ? null
        : Math.max(1, Number(body.aantal));

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is verplicht" },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (status === "open" || status === "afgehandeld") {
      updates.push(`status = $${i++}`);
      values.push(status);
    }

    if (aantal !== null) {
      updates.push(`aantal = $${i++}`);
      values.push(aantal);
    }

    updates.push(`bijgewerkt_op = NOW()`);

    if (updates.length === 1) {
      return NextResponse.json(
        { success: false, error: "Geen geldige wijziging meegegeven" },
        { status: 400 }
      );
    }

    values.push(id);

    const result = await db.query(
      `
      UPDATE maaklijst_items
      SET ${updates.join(", ")}
      WHERE id = $${i}
      RETURNING *
      `,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: "Item niet gevonden" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      item: result.rows[0],
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Fout bij wijzigen maaklijst-item", details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const id = Number(body?.id);

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is verplicht" },
        { status: 400 }
      );
    }

    const result = await db.query(
      `
      DELETE FROM maaklijst_items
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: "Item niet gevonden" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      id,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Fout bij verwijderen maaklijst-item", details: String(error) },
      { status: 500 }
    );
  }
}