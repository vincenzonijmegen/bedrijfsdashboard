import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (type === "skills") {
      const result = await db.query(
        `SELECT id, naam FROM medewerkers ORDER BY naam`
      );
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
