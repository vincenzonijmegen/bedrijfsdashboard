import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await db.query(
      `SELECT email, score, juist, totaal, slug, tijdstip
       FROM resultaten
       ORDER BY tijdstip DESC`
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("🛑 Fout bij ophalen resultaten:", err);
    return NextResponse.json({ error: "Fout bij ophalen resultaten" }, { status: 500 });
  }
}
