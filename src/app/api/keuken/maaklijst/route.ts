import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MaaklijstItemRow = {
  id: number;
  recept_id: number;
  categorie: string;
  naam: string;
  maakvolgorde: number;
  aantal: number;
  status: "open" | "afgehandeld";
};

export async function GET(req: NextRequest) {
  try {
    const datum =
      req.nextUrl.searchParams.get("datum") ||
      new Date().toISOString().slice(0, 10);

    const locatie = req.nextUrl.searchParams.get("locatie") || "keuken";

    const lijstResult = await db.query(
      `
      SELECT id, datum, locatie, status, aangemaakt_op, bijgewerkt_op
      FROM maaklijsten
      WHERE datum = $1::date
        AND locatie = $2
      LIMIT 1
      `,
      [datum, locatie]
    );

    if (lijstResult.rowCount === 0) {
      return NextResponse.json({
        success: true,
        lijst: null,
        items: [],
        openCount: 0,
        doneCount: 0,
      });
    }

    const lijst = lijstResult.rows[0];

    const itemsResult = await db.query(
  `
  SELECT
    id,
    recept_id,
    categorie,
    naam,
    maakvolgorde,
    aantal,
    status
  FROM maaklijst_items
  WHERE maaklijst_id = $1
  ORDER BY
    CASE WHEN status = 'open' THEN 0 ELSE 1 END,
    maakvolgorde ASC,
    naam ASC
  `,
  [lijst.id]
);

const items = itemsResult.rows as MaaklijstItemRow[];
    const openCount = items.filter((x) => x.status === "open").length;
    const doneCount = items.filter((x) => x.status === "afgehandeld").length;

    return NextResponse.json({
      success: true,
      lijst,
      items,
      openCount,
      doneCount,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Fout bij ophalen maaklijst", details: String(error) },
      { status: 500 }
    );
  }
}