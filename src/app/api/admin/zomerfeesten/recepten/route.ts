import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mogelijkeReceptTabellen = ["recepten", "recepturen"];
const mogelijkeNaamKolommen = ["naam", "titel", "recept_naam", "product_naam"];
const mogelijkeCategorieKolommen = ["categorie", "categorie_naam", "type", "soort"];

const quoteIdent = (value: string) => `"${value.replace(/"/g, '""')}"`;

export async function GET() {
  try {
    const tableRes = await db.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])`,
      [mogelijkeReceptTabellen]
    );

    const gevondenTabellen = tableRes.rows.map((row: { table_name: string }) => row.table_name);
    const tabelNaam = mogelijkeReceptTabellen.find((naam) => gevondenTabellen.includes(naam));

    if (!tabelNaam) {
      return NextResponse.json([]);
    }

    const columnRes = await db.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1`,
      [tabelNaam]
    );

    const kolommen = columnRes.rows.map((row: { column_name: string }) => row.column_name);
    const naamKolom = mogelijkeNaamKolommen.find((naam) => kolommen.includes(naam));
    const categorieKolom = mogelijkeCategorieKolommen.find((naam) => kolommen.includes(naam));

    if (!kolommen.includes("id") || !naamKolom) {
      return NextResponse.json([]);
    }

    const result = await db.query(
      `SELECT
         id,
         ${quoteIdent(naamKolom)} AS naam,
         ${categorieKolom ? `COALESCE(${quoteIdent(categorieKolom)}::text, '')` : "''"} AS categorie
       FROM ${quoteIdent(tabelNaam)}
       ORDER BY ${categorieKolom ? `${quoteIdent(categorieKolom)} NULLS LAST, ` : ""}${quoteIdent(naamKolom)}`
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Fout bij ophalen recepten voor Zomerfeesten:", err);
    return NextResponse.json(
      { error: "Kon recepten niet ophalen" },
      { status: 500 }
    );
  }
}
