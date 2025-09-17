import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Selection = { label: string; productNames: string[] }; // ⟵ namen uit omzet
type Payload = {
  dateFrom: string;
  dateTo: string;
  selections: Selection[];
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Payload;

    if (
      !body?.dateFrom ||
      !body?.dateTo ||
      !Array.isArray(body.selections) ||
      body.selections.length === 0
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    if (
      body.selections.some(
        (s) => !s.label || !Array.isArray(s.productNames) || s.productNames.length === 0
      )
    ) {
      return NextResponse.json(
        { error: "Elke selectie moet een label en ≥1 productNaam hebben" },
        { status: 400 }
      );
    }

    // Dynamische kolommen per selectie
    const selectCols: string[] = [];
    const params: any[] = [body.dateFrom, body.dateTo];
    let p = 3;

    for (let i = 0; i < body.selections.length; i++) {
      params.push(body.selections[i].productNames);
      selectCols.push(
        `SUM(j.stuks) FILTER (WHERE j.product_naam = ANY($${p}::text[])) AS sel_${i + 1}`
      );
      p++;
    }

    const query = `
      WITH j AS (
        SELECT
          EXTRACT(YEAR FROM odp.datum)::int AS jaar,
          COALESCE(odp.product_naam, odp.product)::text AS product_naam,
          SUM(odp.aantal)::numeric AS stuks
        FROM rapportage.omzet_dag_product odp
        WHERE odp.datum BETWEEN $1::date AND $2::date
        GROUP BY 1,2
      )
      SELECT j.jaar, ${selectCols.join(", ")}
      FROM j
      GROUP BY j.jaar
      ORDER BY j.jaar;
    `;

    const { rows } = await pool.query(query, params);

    // Herlabelen voor frontend
    const labeled = rows.map((r: any) => {
      const out: Record<string, number | string> = { jaar: r.jaar };
      body.selections.forEach((s, idx) => {
        out[s.label] = Number(r[`sel_${idx + 1}`] ?? 0);
      });
      return out;
    });

    return NextResponse.json({
      rows: labeled,
      selections: body.selections.map((s) => s.label),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
