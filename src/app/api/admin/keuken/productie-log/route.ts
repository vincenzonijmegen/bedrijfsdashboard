import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

type ProductieRapportRow = {
  recept_id: number;
  recept_naam: string;
  categorie: string;
  keren_gemaakt: string;
  totaal_aantal: string;
  laatste_keer: string;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const start = searchParams.get("start");
    const einde = searchParams.get("einde");

    const hasStart = !!start;
    const hasEinde = !!einde;

    let sql = `
      SELECT
        recept_id,
        recept_naam,
        categorie,
        COUNT(*)::text AS keren_gemaakt,
        COALESCE(SUM(aantal), 0)::text AS totaal_aantal,
        MAX(afgehandeld_op)::text AS laatste_keer
      FROM keuken_productie_log
    `;

    const params: string[] = [];

    if (hasStart && hasEinde) {
      sql += `
        WHERE afgehandeld_op::date BETWEEN $1 AND $2
      `;
      params.push(start!, einde!);
    } else if (hasStart) {
      sql += `
        WHERE afgehandeld_op::date >= $1
      `;
      params.push(start!);
    } else if (hasEinde) {
      sql += `
        WHERE afgehandeld_op::date <= $1
      `;
      params.push(einde!);
    }

    sql += `
      GROUP BY recept_id, recept_naam, categorie
      ORDER BY SUM(aantal) DESC, COUNT(*) DESC, recept_naam ASC
    `;

    const result = await query<ProductieRapportRow>(sql, params);

    return NextResponse.json({
      success: true,
      rows: result.rows,
    });
  } catch (error) {
    console.error("GET /api/admin/keuken/productie-log fout:", error);
    return NextResponse.json(
      { success: false, error: "Fout bij ophalen productie-log" },
      { status: 500 }
    );
  }
}