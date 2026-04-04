import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const naam = String(body?.naam || "").trim();
    const slug = String(body?.slug || "").trim();

    if (!naam || !slug) {
      return NextResponse.json(
        { success: false, error: "Naam of slug ontbreekt" },
        { status: 400 }
      );
    }

    await query(
      `
      INSERT INTO keuken_categorieen (naam, slug)
      VALUES ($1, $2)
      `,
      [naam, slug]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST categorie fout:", error);
    return NextResponse.json(
      { success: false, error: "Opslaan mislukt" },
      { status: 500 }
    );
  }
}