import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email ontbreekt" },
        { status: 400 }
      );
    }

    const result = await db.query(
      `
      SELECT *
      FROM sollicitaties
      WHERE LOWER(email) = LOWER($1)
      ORDER BY aangemaakt_op DESC
      LIMIT 1
      `,
      [email]
    );

    return NextResponse.json({
      success: true,
      sollicitatie: result.rows[0] || null,
    });
  } catch (error) {
    console.error("Fout bij ophalen sollicitatie dossier:", error);

    return NextResponse.json(
      { success: false, error: "Fout bij ophalen sollicitatie" },
      { status: 500 }
    );
  }
}