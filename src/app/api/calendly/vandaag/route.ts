import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await db.query(`
      SELECT id, naam, email, starttijd, eindtijd, status, calendly_uri
      FROM sollicitatie_afspraken
      WHERE starttijd::date = CURRENT_DATE
        AND status = 'active'
      ORDER BY starttijd ASC
    `);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Calendly vandaag ophalen error:", error);
    return NextResponse.json(
      { error: "Afspraken vandaag ophalen mislukt" },
      { status: 500 }
    );
  }
}