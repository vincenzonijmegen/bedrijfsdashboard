// src/app/api/beschikbaarheid/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const result = await db.query(
    `SELECT b.*, m.naam
     FROM beschikbaarheid_basis b
     JOIN medewerkers m ON m.id = b.medewerker_id
     ORDER BY m.naam, b.startdatum`
  );
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    medewerker_id,
    startdatum,
    einddatum,
    max_shifts_per_week,
    opmerkingen,
    bron = "beheer",
    ...dagen
  } = body;

  if (!medewerker_id || !startdatum || !einddatum) {
    return NextResponse.json({ error: "Verplichte velden ontbreken" }, { status: 400 });
  }

  // Alleen oudere records van 'medewerker' verwijderen, beheer blijft intact
  if (bron === 'medewerker') {
    await db.query(
      `DELETE FROM beschikbaarheid_basis
       WHERE medewerker_id = $1 AND bron = $2
         AND NOT (einddatum < $3 OR startdatum > $4)`,
      [medewerker_id, bron, startdatum, einddatum]
    );
  }

  const kolommen = [
    "medewerker_id", "startdatum", "einddatum", "max_shifts_per_week", "opmerkingen", "bron",
    ...Object.keys(dagen)
  ];
  const waarden = [
    medewerker_id,
    startdatum,
    einddatum,
    max_shifts_per_week,
    opmerkingen || null,
    bron,
    ...Object.values(dagen)
  ];
  const placeholders = kolommen.map((_, i) => `$${i + 1}`).join(", ");

  await db.query(
    `INSERT INTO beschikbaarheid_basis (${kolommen.join(", ")}) VALUES (${placeholders})`,
    waarden
  );

  return NextResponse.json({ status: "ok" });
}
