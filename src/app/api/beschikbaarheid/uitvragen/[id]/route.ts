import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const rondeId = Number(id);
    const ronde = await db.query(
  `SELECT * FROM beschikbaarheids_rondes WHERE id = $1`,
  [rondeId]
);

    if (ronde.rowCount === 0) {
      return NextResponse.json({ error: "Uitvraag niet gevonden" }, { status: 404 });
    }

    return NextResponse.json(ronde.rows[0]);
  } catch (error) {
    console.error("Fout bij laden uitvraag:", error);
    return NextResponse.json({ error: "Laden mislukt" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const rondeId = Number(id);

    if (!Number.isFinite(rondeId)) {
      return NextResponse.json({ error: "Ongeldige uitvraag-id" }, { status: 400 });
    }

    const body = await req.json();
    const { status } = body;

    if (!["concept", "actief", "gesloten"].includes(status)) {
      return NextResponse.json({ error: "Ongeldige status" }, { status: 400 });
    }

    const result = await db.query(
      `UPDATE beschikbaarheids_rondes SET status = $1 WHERE id = $2 RETURNING *`,
      [status, rondeId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Uitvraag niet gevonden" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Fout bij bijwerken uitvraag:", error);
    return NextResponse.json({ error: "Bijwerken mislukt" }, { status: 500 });
  }
}
