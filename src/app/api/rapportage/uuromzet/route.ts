import { dbRapportage } from "@/lib/dbRapportage";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "Start- en einddatum zijn vereist (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const result = await dbRapportage.query(
      `
      SELECT
        TO_CHAR(datum, 'YYYY-MM-DD') AS dag,
        TO_CHAR(tijdstip, 'HH24:00') AS uur,
        ROUND(SUM(aantal * eenheidsprijs)) AS omzet
      FROM rapportage.omzet_dag
      WHERE datum BETWEEN $1 AND $2
      GROUP BY dag, uur
      ORDER BY dag, uur
      `,
      [start, end]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    return NextResponse.json({ error: "Fout bij ophalen omzetgegevens: " + String(err) }, { status: 500 });
  }
}
