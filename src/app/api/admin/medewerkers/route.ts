// src/app/api/admin/medewerkers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { rows: medewerkers } = await db.query(
    `
    SELECT 
      email, 
      naam, 
      functie,
      kan_scheppen,
      kan_voorbereiden,
      kan_ijsbereiden
    FROM medewerkers 
    ORDER BY naam
    `
  );

  return NextResponse.json(medewerkers);
}