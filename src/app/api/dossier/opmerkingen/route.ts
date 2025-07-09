// src/app/api/dossier/opmerkingen/route.ts

import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { email, tekst } = await req.json();

  if (!email || !tekst) {
    return NextResponse.json({ error: "Email en tekst zijn verplicht" }, { status: 400 });
  }

  try {
    await db.query(
      `INSERT INTO personeelsopmerkingen (email, tekst, datum)
       VALUES ($1, $2, NOW())`,
      [email, tekst]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Fout bij opslaan opmerking:", err);
    return NextResponse.json({ error: "Databasefout" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Email ontbreekt" }, { status: 400 });
  }

  try {
    const result = await db.query(
      `SELECT tekst, datum
       FROM personeelsopmerkingen
       WHERE email = $1
       ORDER BY datum DESC`,
      [email]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Fout bij ophalen opmerkingen:", err);
    return NextResponse.json({ error: "Databasefout" }, { status: 500 });
  }
}
