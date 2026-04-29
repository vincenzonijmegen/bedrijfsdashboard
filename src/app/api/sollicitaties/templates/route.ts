import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { rows } = await db.query(
      `
      SELECT id, naam, onderwerp, html
      FROM sollicitatie_afwijzing_templates
      WHERE actief = true
      ORDER BY sortering
      `
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error("Fout bij ophalen templates:", err);
    return NextResponse.json(
      { error: "Interne serverfout" },
      { status: 500 }
    );
  }
}