// src/app/api/leveranciers/route.ts

import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await db.query("SELECT id, naam FROM leveranciers ORDER BY naam");
    return NextResponse.json(res.rows);
  } catch (err) {
    console.error("Fout bij ophalen leveranciers:", err);
    return NextResponse.json({ error: "Databasefout" }, { status: 500 });
  }
}
