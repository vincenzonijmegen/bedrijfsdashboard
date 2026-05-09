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
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
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

    const result = await db.query(
      `
      UPDATE infotheek_artikelen
      SET
        titel = $1,
        categorie = $2,
        samenvatting = $3,
        inhoud = $4,
        zoekwoorden = $5,
        laatst_bijgewerkt_op = now()
      WHERE slug = $6
      RETURNING slug
      `,
      [titel, categorie, samenvatting, inhoud, zoekwoorden, slug]
    );

    if (!result.rowCount) {
      return NextResponse.json(
        { success: false, error: "Artikel niet gevonden" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      slug: result.rows[0].slug,
    });
  } catch (error) {
    console.error("Fout bij bijwerken infotheek-artikel:", error);
    return NextResponse.json(
      { success: false, error: "Fout bij bijwerken artikel" },
      { status: 500 }
    );
  }
}