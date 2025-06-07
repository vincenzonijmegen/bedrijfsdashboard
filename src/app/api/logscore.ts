import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db"; // gebruik jouw bestaande db-configuratie

export async function POST(req: NextRequest) {
  const data = await req.json();
  const { email, score, aantalJuist, totaal, tijdstip, slug } = data;

  try {
    await db.query(
      "INSERT INTO toetsresultaten (email, score, juist, totaal, slug, tijdstip) VALUES ($1, $2, $3, $4, $5, $6)",
      [email, score, aantalJuist, totaal, slug ?? null, tijdstip]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Fout bij opslaan toetsresultaat:", err);
    return NextResponse.json({ error: "Fout bij opslaan" }, { status: 500 });
  }
}
