import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import slugify from "slugify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";

    const result = await db.query(
      `
      SELECT
        id,
        slug,
        titel,
        categorie,
        samenvatting,
        zoekwoorden,
        doelgroep,
        laatst_bijgewerkt_op
      FROM infotheek_artikelen
      WHERE actief = true
        AND (
          $1 = ''
          OR titel ILIKE '%' || $1 || '%'
          OR categorie ILIKE '%' || $1 || '%'
          OR samenvatting ILIKE '%' || $1 || '%'
          OR inhoud ILIKE '%' || $1 || '%'
          OR EXISTS (
            SELECT 1
            FROM unnest(zoekwoorden) AS z
            WHERE z ILIKE '%' || $1 || '%'
          )
        )
      ORDER BY categorie ASC, titel ASC
      `,
      [q]
    );

    return NextResponse.json({ success: true, artikelen: result.rows });
  } catch (error) {
    console.error("Fout bij ophalen infotheek:", error);
    return NextResponse.json(
      { success: false, error: "Fout bij ophalen infotheek" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const titel = String(body.titel || "").trim();
    const categorie = String(body.categorie || "").trim();
    const samenvatting = String(body.samenvatting || "").trim();
    const inhoud = String(body.inhoud || "").trim();
    const zoekwoorden: string[] = Array.isArray(body.zoekwoorden)
  ? body.zoekwoorden
      .map((v: unknown) => String(v).trim())
      .filter(Boolean)
  : [];

    if (!titel || !categorie || !inhoud) {
      return NextResponse.json(
        { success: false, error: "Titel, categorie en inhoud zijn verplicht" },
        { status: 400 }
      );
    }

    const slug = slugify(titel, { lower: true, strict: true });

    const result = await db.query(
      `
      INSERT INTO infotheek_artikelen
        (slug, titel, categorie, samenvatting, inhoud, zoekwoorden)
      VALUES
        ($1, $2, $3, $4, $5, $6)
      RETURNING slug
      `,
      [slug, titel, categorie, samenvatting, inhoud, zoekwoorden]
    );

    return NextResponse.json({ success: true, slug: result.rows[0].slug });
  } catch (error) {
    console.error("Fout bij opslaan infotheek-artikel:", error);
    return NextResponse.json(
      { success: false, error: "Fout bij opslaan artikel" },
      { status: 500 }
    );
  }
}