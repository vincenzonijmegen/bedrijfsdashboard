// src/app/api/medewerkers/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sendUitnodiging } from "@/lib/mail";

// GET /api/medewerkers or /api/medewerkers?type=functies
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");

  if (type === "functies") {
    const result = await db.query(
      "SELECT id, naam FROM functies ORDER BY naam"
    );
    return NextResponse.json(result.rows);
  }

  const result = await db.query(
    `SELECT m.id, m.naam, m.email, m.functie AS functie_id, f.naam AS functie_naam
     FROM medewerkers m
     LEFT JOIN functies f ON m.functie = f.id
     ORDER BY m.naam`
  );

  return NextResponse.json(result.rows);
}

// POST new medewerker + invite
export async function POST(req: NextRequest) {
  const { naam, email, functie } = await req.json();

  if (!naam || !email) {
    return NextResponse.json(
      { success: false, error: "Naam en e-mail zijn verplicht" },
      { status: 400 }
    );
  }

  // check op bestaand e-mailadres
  const check = await db.query(
    "SELECT 1 FROM medewerkers WHERE email = $1",
    [email]
  );
  if ((check.rowCount ?? 0) > 0) {
    return NextResponse.json(
      { success: false, error: "E-mailadres bestaat al" },
      { status: 400 }
    );
  }

  // genereer tijdelijk wachtwoord en hash
  const tijdelijkWachtwoord = Math.random().toString(36).slice(-8);
  const hashed = await bcrypt.hash(tijdelijkWachtwoord, 10);

  // opslaan in DB
  await db.query(
    `INSERT INTO medewerkers
       (naam, email, functie, wachtwoord, moet_wachtwoord_wijzigen)
     VALUES ($1, $2, $3, $4, true)`,
    [naam, email, functie ?? null, hashed]
  );

  // stuur uitnodiging
  await sendUitnodiging(email, naam, tijdelijkWachtwoord);

  return NextResponse.json({ success: true });
}

// PUT update medewerker functie
export async function PUT(req: NextRequest) {
  const { id, functie_id } = await req.json();

  if (!id) {
    return NextResponse.json(
      { error: "ID is verplicht" },
      { status: 400 }
    );
  }

  await db.query(
    "UPDATE medewerkers SET functie = $1 WHERE id = $2",
    [functie_id ?? null, id]
  );

  return NextResponse.json({ success: true });
}

// DELETE medewerker by id or email
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const email = req.nextUrl.searchParams.get("email");

  if (id) {
    await db.query(
      "DELETE FROM medewerkers WHERE id = $1",
      [id]
    );
  } else if (email) {
    await db.query(
      "DELETE FROM medewerkers WHERE email = $1",
      [email]
    );
  } else {
    return NextResponse.json(
      { error: "ID of e-mail is vereist" },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
