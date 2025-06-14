import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// POST: resultaten opslaan
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { naam, email, score, juist, totaal, slug, tijdstip, functie } = body;

    await db.query(
      `INSERT INTO toetsresultaten (naam, email, score, juist, totaal, slug, tijdstip, functie)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [naam, email, score, juist, totaal, slug, tijdstip || new Date(), functie]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Fout bij opslaan resultaat:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET: resultaten ophalen
export async function GET() {
  try {
    const result = await db.query(
      `SELECT naam, email, score, juist, totaal, slug, tijdstip, functie
       FROM toetsresultaten
       ORDER BY tijdstip DESC`
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("❌ Fout bij ophalen resultaten:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
