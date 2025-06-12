import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("📡 API: /api/resultaten aangeroepen");

    const result = await db.query(
      `SELECT naam, email, score, juist, totaal, slug, COALESCE(tijdstip, NOW()) as tijdstip FROM toetsresultaten ORDER BY tijdstip DESC`
    );

    console.log("✅ Kolommen:", Object.keys(result.rows[0] || {}));

    console.log("✅ Resultaten opgehaald:", result.rows.length);
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("🛑 Fout bij ophalen resultaten:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const slug = searchParams.get("slug");

  if (!email || !slug) {
    return NextResponse.json({ error: "email en slug zijn vereist" }, { status: 400 });
  }

  try {
    await db.query(
      `DELETE FROM toetsresultaten WHERE email = $1 AND slug = $2`,
      [email, slug]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("🛑 Fout bij verwijderen resultaat:", err);
    return NextResponse.json({ error: "Verwijderen mislukt" }, { status: 500 });
  }
}
