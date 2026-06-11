import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await db.query(`
      SELECT
        r.*,
        COUNT(d.id)::int AS aantal_deelnemers,
        COUNT(d.id) FILTER (WHERE d.status = 'open')::int AS aantal_open,
        COUNT(d.id) FILTER (WHERE d.status = 'ingevuld')::int AS aantal_ingevuld,
        COUNT(d.id) FILTER (WHERE d.status = 'uitgesteld')::int AS aantal_uitgesteld
      FROM beschikbaarheids_rondes r
      LEFT JOIN beschikbaarheids_deelnames d ON d.ronde_id = r.id
      GROUP BY r.id
      ORDER BY r.start_datum DESC, r.id DESC
    `);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Fout bij laden beschikbaarheidsuitvragen:", error);
    return NextResponse.json({ error: "Laden mislukt" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { naam, start_datum, eind_datum, deadline, toelichting } = body;

    if (!naam || !start_datum || !eind_datum) {
      return NextResponse.json({ error: "Naam, startdatum en einddatum zijn verplicht" }, { status: 400 });
    }

    const result = await db.query(
      `INSERT INTO beschikbaarheids_rondes
        (naam, start_datum, eind_datum, deadline, toelichting, status)
       VALUES ($1, $2, $3, $4, $5, 'actief')
       RETURNING *`,
      [naam, start_datum, eind_datum, deadline || null, toelichting || null]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Fout bij aanmaken beschikbaarheidsuitvraag:", error);
    return NextResponse.json({ error: "Aanmaken mislukt" }, { status: 500 });
  }
}
