import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const recept_id = Number(body?.recept_id);
    const recept_naam = String(body?.recept_naam || "").trim();
    const categorie = String(body?.categorie || "").trim();
    const aantal = Number(body?.aantal || 1);

    if (!recept_id || !recept_naam || !categorie || !aantal) {
      return NextResponse.json(
        { success: false, error: "Onvolledige invoer" },
        { status: 400 }
      );
    }

    await query(
      `
      INSERT INTO keuken_productie_log (
        recept_id,
        recept_naam,
        categorie,
        aantal
      )
      VALUES ($1, $2, $3, $4)
      `,
      [recept_id, recept_naam, categorie, aantal]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/keuken/productie-log fout:", error);
    return NextResponse.json(
      { success: false, error: "Logging mislukt" },
      { status: 500 }
    );
  }
}