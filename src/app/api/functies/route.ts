// src/app/api/functies/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const result = await db.query("SELECT * FROM functies ORDER BY naam");
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Fout bij ophalen functies:", error);
    return NextResponse.json({ error: "Fout bij ophalen" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, omschrijving } = body;

    if (!id) {
      return NextResponse.json({ error: "ID ontbreekt" }, { status: 400 });
    }

    await db.query(
      "UPDATE functies SET omschrijving = $1 WHERE id = $2",
      [omschrijving || "", id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fout bij bijwerken functie:", error);
    return NextResponse.json({ error: "Fout bij bijwerken" }, { status: 500 });
  }
}