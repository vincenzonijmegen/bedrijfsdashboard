import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get("type");
    console.log("📥 Type-param:", type);

    if (type === "skills") {
      console.log("🎯 Skills-query uitgevoerd");
      const result = await db.query(
        `SELECT id, naam, categorie FROM skills ORDER BY categorie, naam`
      );
      return NextResponse.json(result.rows);
    }

    console.log("👤 Medewerkers-query uitgevoerd");
    const result = await db.query(
      `SELECT id, naam FROM medewerkers ORDER BY naam`
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Fout bij ophalen gegevens:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}
