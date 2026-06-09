import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseInit = {
  headers: {
    "Cache-Control": "no-store, max-age=0",
  },
};

export async function GET() {
  try {
    const columnRes = await db.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'recepten'`
    );

    const kolommen = columnRes.rows.map(
      (row: { column_name: string }) => row.column_name
    );

    if (!kolommen.includes("id")) {
      return NextResponse.json(
        { error: "Tabel recepten heeft geen kolom id" },
        { status: 500, ...responseInit }
      );
    }

    const naamKolom = ["naam", "titel", "recept_naam", "product_naam"].find((kolom) =>
      kolommen.includes(kolom)
    );

    if (!naamKolom) {
      return NextResponse.json(
        { error: "Geen naamkolom gevonden in tabel recepten" },
        { status: 500, ...responseInit }
      );
    }

    const categorieKolom = ["categorie", "categorie_naam", "type", "soort"].find((kolom) =>
      kolommen.includes(kolom)
    );

    const quoteIdent = (value: string) => `"${value.replace(/"/g, '""')}"`;

    const result = await db.query(
      `SELECT
         id,
         ${quoteIdent(naamKolom)}::text AS naam,
         ${categorieKolom ? `COALESCE(${quoteIdent(categorieKolom)}::text, '')` : "''"} AS categorie
       FROM recepten
       WHERE ${quoteIdent(naamKolom)} IS NOT NULL
         AND TRIM(${quoteIdent(naamKolom)}::text) <> ''
       ORDER BY LOWER(${quoteIdent(naamKolom)}::text)`
    );

    return NextResponse.json(result.rows, responseInit);
  } catch (err) {
    console.error("Fout bij ophalen recepten voor Zomerfeesten:", err);
    return NextResponse.json(
      { error: "Kon recepten niet ophalen" },
      { status: 500, ...responseInit }
    );
  }
}
