import { NextResponse } from "next/server";
import { query } from "@/lib/db";

type CategorieRow = {
  slug: string;
  naam: string;
  sortering: number;
};

export async function GET() {
  try {
    const result = await query<CategorieRow>(
      `
      SELECT slug, naam, sortering
      FROM keuken_categorieen
      WHERE actief = true
      ORDER BY sortering ASC, naam ASC
      `
    );

    return NextResponse.json({
      success: true,
      items: result.rows,
    });
  } catch (error) {
    console.error("GET /api/keuken/categorieen fout:", error);
    return NextResponse.json(
      { success: false, error: "Fout bij ophalen categorieën" },
      { status: 500 }
    );
  }
}