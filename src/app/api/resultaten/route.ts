import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email, naam, functie, juist, totaal, slug } = await req.json();

    if (!email || !naam || !slug) {
      return NextResponse.json({ success: false, error: "Onvolledige gegevens" }, { status: 400 });
    }

    const tijdstip = new Date().toISOString();

    await db.query(
      `INSERT INTO toetsresultaten (email, naam, functie, juist, totaal, slug, tijdstip) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [email, naam, functie || null, juist, totaal, slug, tijdstip]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Fout bij opslaan resultaat:", err);
    return NextResponse.json({ success: false, error: "Opslaan mislukt" }, { status: 500 });
  }
}
