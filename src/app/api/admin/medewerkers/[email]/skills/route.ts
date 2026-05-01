import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params;
    const body = await req.json();

    const kan_scheppen = Boolean(body.kan_scheppen);
    const kan_voorbereiden = Boolean(body.kan_voorbereiden);
    const kan_ijsbereiden = Boolean(body.kan_ijsbereiden);

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email ontbreekt" },
        { status: 400 }
      );
    }

    const result = await db.query(
      `
      UPDATE medewerkers
      SET
        kan_scheppen = $1,
        kan_voorbereiden = $2,
        kan_ijsbereiden = $3
      WHERE email = $4
      RETURNING
        email,
        naam,
        kan_scheppen,
        kan_voorbereiden,
        kan_ijsbereiden
      `,
      [
        kan_scheppen,
        kan_voorbereiden,
        kan_ijsbereiden,
        decodeURIComponent(email),
      ]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: "Medewerker niet gevonden" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      medewerker: result.rows[0],
    });
  } catch (error) {
    console.error("Fout bij opslaan planning-skills:", error);

    return NextResponse.json(
      { success: false, error: "Opslaan planning-skills mislukt" },
      { status: 500 }
    );
  }
}