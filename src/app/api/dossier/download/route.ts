// src/app/api/dossier/document/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Geen e-mailadres opgegeven" }, { status: 400 });
  }

  try {
    const result = await db.query(
      `SELECT bestand_url FROM personeelsdocumenten
       WHERE email = $1 AND type = 'sollicitatie'
       ORDER BY toegevoegd_op DESC LIMIT 1`,
      [email]
    );

    const url = result.rows[0]?.bestand_url;

    if (!url) {
      return NextResponse.json({ error: "Geen bestand gevonden" }, { status: 404 });
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Fout bij ophalen personeelsbestand:", err);
    return NextResponse.json({ error: "Databasefout" }, { status: 500 });
  }
}
