import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const { rows } = await pool.query(
      `
      SELECT DISTINCT COALESCE(odp.product_naam, odp.product)::text AS naam
      FROM rapportage.omzet_dag_product odp
      WHERE ($1::date IS NULL OR odp.datum >= $1::date)
        AND ($2::date IS NULL OR odp.datum <= $2::date)
      ORDER BY 1;
      `,
      [dateFrom, dateTo]
    );

    // Gebruik de naam als key (stabiel genoeg voor selectie)
    const out = rows.map((r: any) => ({ id: r.naam as string, naam: r.naam as string }));
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
