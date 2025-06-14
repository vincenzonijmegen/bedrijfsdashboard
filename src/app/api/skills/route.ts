import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await db.query(
      `SELECT id, naam, categorie FROM skills WHERE actief = true ORDER BY categorie, naam`
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Fout bij ophalen skills:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}
