// 📄 Bestand: src/app/api/vragen/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyJWT } from "@/lib/auth";

// Helperfunctie om medewerker-id op te halen via JWT
async function getGebruikerMetId(req: NextRequest) {
  try {
    const payload = verifyJWT(req); // bevat email, naam, functie
    const { rows } = await db.query(
      "SELECT id, naam, email FROM medewerkers WHERE email = $1",
      [payload.email]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

// ✅ GET: eigen vragen ophalen
export async function GET(req: NextRequest) {
  const gebruiker = await getGebruikerMetId(req);
  if (!gebruiker) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { rows } = await db.query(
    `SELECT id, vraag, antwoord, aangemaakt_op
     FROM vragen
     WHERE medewerker_id = $1
     ORDER BY aangemaakt_op DESC`,
    [gebruiker.id]
  );

  return NextResponse.json(rows);
}

// ✅ POST: nieuwe vraag indienen
export async function POST(req: NextRequest) {
  const gebruiker = await getGebruikerMetId(req);
  if (!gebruiker) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const body = await req.json();
  const vraag = body.vraag?.trim();

  if (!vraag) {
    return NextResponse.json({ error: "Vraag is verplicht" }, { status: 400 });
  }

  const { rows } = await db.query(
    `INSERT INTO vragen (medewerker_id, vraag, aangemaakt_op)
     VALUES ($1, $2, NOW())
     RETURNING id, vraag, antwoord, aangemaakt_op`,
    [gebruiker.id, vraag]
  );

  return NextResponse.json(rows[0]);
}
