import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rows } = await db.query(`
      SELECT
        id,
        naam,
        start_datum,
        eind_datum,
        status,
        created_at
      FROM planning_periodes
      ORDER BY start_datum DESC
    `);

    return NextResponse.json({ success: true, periodes: rows });
  } catch (error) {
    console.error("Fout bij ophalen planningsperiodes:", error);
    return NextResponse.json(
      { success: false, error: "Ophalen planningsperiodes mislukt" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const naam = String(body.naam || "").trim();
    const start_datum = String(body.start_datum || "").trim();
    const eind_datum = String(body.eind_datum || "").trim();

    if (!naam || !start_datum || !eind_datum) {
      return NextResponse.json(
        { success: false, error: "Naam, startdatum en einddatum zijn verplicht" },
        { status: 400 }
      );
    }

    const { rows } = await db.query(
      `
      INSERT INTO planning_periodes (naam, start_datum, eind_datum, status)
      VALUES ($1, $2::date, $3::date, 'concept')
      RETURNING
        id,
        naam,
        start_datum,
        eind_datum,
        status,
        created_at
      `,
      [naam, start_datum, eind_datum]
    );

    return NextResponse.json({ success: true, periode: rows[0] });
  } catch (error) {
    console.error("Fout bij aanmaken planningsperiode:", error);
    return NextResponse.json(
      { success: false, error: "Aanmaken planningsperiode mislukt" },
      { status: 500 }
    );
  }
}