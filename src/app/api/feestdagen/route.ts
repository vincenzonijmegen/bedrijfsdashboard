import { NextRequest, NextResponse } from "next/server";
import { dbRapportage } from "@/lib/dbRapportage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const jaar =
      req.nextUrl.searchParams.get("jaar") || String(new Date().getFullYear());

    const result = await dbRapportage.query(
      `
      SELECT
        naam,
        TO_CHAR(datum, 'YYYY-MM-DD') AS datum
      FROM rapportage.feestdagen
      WHERE EXTRACT(YEAR FROM datum) = $1::int
      ORDER BY datum ASC
      `,
      [jaar]
    );

    return NextResponse.json({
      success: true,
      jaar: Number(jaar),
      feestdagen: result.rows,
    });
  } catch (error) {
    console.error("Fout bij ophalen feestdagen:", error);

    return NextResponse.json(
      { success: false, error: "Fout bij ophalen feestdagen" },
      { status: 500 }
    );
  }
}