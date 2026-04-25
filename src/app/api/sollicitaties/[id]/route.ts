import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const geldigeStatussen = [
  "nieuw",
  "uitgenodigd",
  "gesprek gepland",
  "in de wacht",
  "aangenomen",
  "afgewezen",
];

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

    const status = String(body?.status || "").trim();

    if (!geldigeStatussen.includes(status)) {
      return NextResponse.json(
        { success: false, error: "Ongeldige status" },
        { status: 400 }
      );
    }

    await db.query(
      `
      UPDATE sollicitaties
      SET
        status = $1,
        aangenomen_op = CASE WHEN $1 = 'aangenomen' THEN COALESCE(aangenomen_op, NOW()) ELSE aangenomen_op END,
        afgewezen_op = CASE WHEN $1 = 'afgewezen' THEN COALESCE(afgewezen_op, NOW()) ELSE afgewezen_op END
      WHERE id = $2
      `,
      [status, id]
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