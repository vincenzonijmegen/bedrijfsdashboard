// Bestand: src/app/api/notities/route.ts

import { dbRapportage } from "@/lib/dbRapportage";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rubriekId = searchParams.get("rubriek_id");

  if (rubriekId) {
    const res = await dbRapportage.query(
      `
      SELECT id, rubriek_id, tekst, volgorde, datum
      FROM rapportage.notities
      WHERE rubriek_id = $1
      ORDER BY datum DESC NULLS LAST, volgorde ASC
      `,
      [rubriekId]
    );

    return NextResponse.json(res.rows);
  }

  const res = await dbRapportage.query(`
    SELECT id, naam
    FROM rapportage.rubrieken
    ORDER BY naam
  `);

  return NextResponse.json(res.rows);
}

export async function POST(req: Request) {
  const body = await req.json();

  if (body.naam) {
    await dbRapportage.query(
      `
      INSERT INTO rapportage.rubrieken (naam)
      VALUES ($1)
      `,
      [body.naam]
    );

    return NextResponse.json({ success: true });
  }

  if (body.rubriek_id && body.tekst) {
    await dbRapportage.query(
      `
      INSERT INTO rapportage.notities (rubriek_id, tekst, datum, volgorde)
      VALUES (
        $1,
        $2,
        COALESCE($3::date, CURRENT_DATE),
        (
          SELECT COALESCE(MAX(volgorde), 0) + 1
          FROM rapportage.notities
          WHERE rubriek_id = $1
        )
      )
      `,
      [body.rubriek_id, body.tekst, body.datum || null]
    );

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Ongeldige payload" }, { status: 400 });
}

export async function PATCH(req: Request) {
  const body = await req.json();

  if (body.naam && body.id && body.type === "rubriek") {
    await dbRapportage.query(
      `
      UPDATE rapportage.rubrieken
      SET naam = $1
      WHERE id = $2
      `,
      [body.naam, body.id]
    );

    return NextResponse.json({ success: true });
  }

  if (body.tekst && body.id && body.type === "notitie") {
    await dbRapportage.query(
      `
      UPDATE rapportage.notities
      SET tekst = $1,
          datum = COALESCE($2::date, datum)
      WHERE id = $3
      `,
      [body.tekst, body.datum || null, body.id]
    );

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Ongeldige payload" }, { status: 400 });
}

export async function DELETE(req: Request) {
  const { id, type } = await req.json();

  if (type === "rubriek") {
    await dbRapportage.query(
      `
      DELETE FROM rapportage.rubrieken
      WHERE id = $1
      `,
      [id]
    );

    return NextResponse.json({ success: true });
  }

  if (type === "notitie") {
    await dbRapportage.query(
      `
      DELETE FROM rapportage.notities
      WHERE id = $1
      `,
      [id]
    );

    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { error: "Missing or invalid type" },
    { status: 400 }
  );
}