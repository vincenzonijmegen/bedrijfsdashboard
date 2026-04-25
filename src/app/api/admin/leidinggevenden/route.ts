// src/app/api/admin/leidinggevenden/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await db.query(
      `
      SELECT id, naam
      FROM leidinggevenden
      WHERE actief = true
      ORDER BY naam ASC
      `
    );

    return NextResponse.json({
      success: true,
      leidinggevenden: result.rows,
    });
  } catch (error) {
    console.error("Fout bij ophalen leidinggevenden:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Fout bij ophalen leidinggevenden",
      },
      { status: 500 }
    );
  }
}