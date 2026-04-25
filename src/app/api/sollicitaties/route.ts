import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await db.query(`
    SELECT
      id,
      voornaam,
      achternaam,
      email,
      telefoon,
      status,
      voorkeur_functie,
      shifts_per_week,
      gesprek_datum,
      aangemaakt_op
    FROM sollicitaties
    ORDER BY
      CASE status
        WHEN 'nieuw' THEN 1
        WHEN 'uitgenodigd' THEN 2
        WHEN 'gesprek gepland' THEN 3
        WHEN 'in de wacht' THEN 4
        WHEN 'aangenomen' THEN 5
        WHEN 'afgewezen' THEN 6
        ELSE 9
      END,
      aangemaakt_op DESC
  `);

  return NextResponse.json(result.rows);
}