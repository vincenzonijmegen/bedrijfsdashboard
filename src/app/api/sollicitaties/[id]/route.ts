import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const geldigeStatussen = [
  "nieuw",
  "uitgenodigd",
  "gesprek gepland",
  "in de wacht",
  "wacht op gegevens",
  "aangenomen",
  "afgewezen",
];

function cleanOptional(value: unknown) {
  if (value === undefined) return undefined;
  const cleaned = String(value ?? "").trim();
  return cleaned || null;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const result = await db.query(`SELECT * FROM sollicitaties WHERE id = $1`, [
    id,
  ]);

  if (result.rowCount === 0) {
    return NextResponse.json(
      { success: false, error: "Sollicitatie niet gevonden" },
      { status: 404 }
    );
  }

  return NextResponse.json(result.rows[0]);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const status =
      body?.status === undefined ? undefined : String(body.status).trim();

    const gesprekDatum = cleanOptional(body?.gesprek_datum);
    const gesprekNotities = cleanOptional(body?.gesprek_notities);

    if (status !== undefined && !geldigeStatussen.includes(status)) {
      return NextResponse.json(
        { success: false, error: "Ongeldige status" },
        { status: 400 }
      );
    }

    await db.query(
      `
      UPDATE sollicitaties
      SET
        status = COALESCE($1, status),
        gesprek_datum = COALESCE($2::timestamptz, gesprek_datum),
        gesprek_notities = COALESCE($3, gesprek_notities),
        aangenomen_op = CASE
          WHEN $1 = 'aangenomen' THEN COALESCE(aangenomen_op, NOW())
          ELSE aangenomen_op
        END,
        afgewezen_op = CASE
          WHEN $1 = 'afgewezen' THEN COALESCE(afgewezen_op, NOW())
          ELSE afgewezen_op
        END
      WHERE id = $4
      `,
      [status ?? null, gesprekDatum, gesprekNotities, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fout bij aanpassen sollicitatie:", error);

    return NextResponse.json(
      { success: false, error: "Serverfout" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const result = await db.query(
      `
      DELETE FROM sollicitaties
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: "Sollicitatie niet gevonden" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fout bij verwijderen sollicitatie:", error);

    return NextResponse.json(
      { success: false, error: "Verwijderen mislukt" },
      { status: 500 }
    );
  }
}