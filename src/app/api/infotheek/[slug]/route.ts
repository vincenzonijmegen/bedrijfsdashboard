import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const result = await db.query(
      `
      SELECT *
      FROM infotheek_artikelen
      WHERE slug = $1
        AND actief = true
      LIMIT 1
      `,
      [slug]
    );

    if (!result.rowCount) {
      return NextResponse.json(
        { success: false, error: "Artikel niet gevonden" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, artikel: result.rows[0] });
  } catch (error) {
    console.error("Fout bij ophalen infotheek-artikel:", error);
    return NextResponse.json(
      { success: false, error: "Fout bij ophalen artikel" },
      { status: 500 }
    );
  }
}