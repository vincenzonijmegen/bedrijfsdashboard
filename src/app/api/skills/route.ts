import { db } from "@/lib/db";
import { NextResponse } from "next/server";

import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type");

    if (type === "skills") {
      const result = await db.query(
        `SELECT id, naam FROM skills ORDER BY naam`
      );
      console.log("🧠 API response for type=skills:", result.rows);
      return NextResponse.json(result.rows);
    }

    const result = await db.query(
      `SELECT naam, email, functie FROM medewerkers ORDER BY naam`
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Fout bij ophalen medewerkers:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}
