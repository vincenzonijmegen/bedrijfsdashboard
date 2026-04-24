import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await db.query(`
SELECT id, naam, email, starttijd, eindtijd, status, calendly_uri
FROM sollicitatie_afspraken
WHERE starttijd >= CURRENT_DATE
ORDER BY starttijd ASC
    `);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Calendly afspraken ophalen error:", error);
    return NextResponse.json(
      { error: "Afspraken ophalen mislukt" },
      { status: 500 }
    );
  }
}