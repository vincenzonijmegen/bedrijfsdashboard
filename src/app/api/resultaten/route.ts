import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("📡 API: /api/resultaten aangeroepen");

    const result = await db.query(
      `SELECT * FROM toetsresultaten LIMIT 1`
    );

    console.log("✅ Kolommen:", Object.keys(result.rows[0] || {}));

    console.log("✅ Resultaten opgehaald:", result.rows.length);
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("🛑 Fout bij ophalen resultaten:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
