import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    console.log("📥 Ontvangen logscore data:", data);

    const { email, score, aantalJuist, totaal, tijdstip, slug } = data;

    const result = await db.query(
      "INSERT INTO toetsresultaten (email, score, juist, totaal, tijdstip, slug) VALUES ($1, $2, $3, $4, $5, $6)",
      [email, score, aantalJuist, totaal, tijdstip, slug]
    );

    console.log("✅ Gegevens opgeslagen:", result.rowCount);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ Fout bij opslaan logscore:", err);
    return NextResponse.json({ error: "Opslaan mislukt" }, { status: 500 });
  }
}
