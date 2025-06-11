import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    console.log("📥 Data ontvangen in logscore API:", data);

    const { email, score, aantalJuist, totaal, tijdstip, slug } = data;

    // validatie
    if (!email || !slug || !tijdstip) {
      console.warn("⚠️ Ontbrekende verplichte velden");
      return NextResponse.json({ error: "Verplichte velden ontbreken" }, { status: 400 });
    }

    const result = await db.query(
      "INSERT INTO toetsresultaten (email, score, juist, totaal, tijdstip, slug) VALUES ($1, $2, $3, $4, $5, $6)",
      [email, score, aantalJuist, totaal, tijdstip, slug]
    );

    console.log("✅ Resultaat opgeslagen:", result.rowCount);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("❌ Fout in /api/logscore:", err.message);
    return NextResponse.json({ error: "Interne fout: " + err.message }, { status: 500 });
  }
}
