import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email, naam, functie, slug, score, juist, totaal } = await req.json();

    // timestamp toevoegen
    const tijdstip = new Date();

    await db.query(
      `INSERT INTO toetsresultaten (email, naam, functie, slug, score, juist, totaal, tijdstip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [email, naam, functie, slug, score, juist, totaal, tijdstip]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Fout bij opslaan resultaat:", err);
    return NextResponse.json({ success: false, error: "Fout bij opslaan resultaat" }, { status: 500 });
  }
}
