import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const periode_id = searchParams.get("periode_id");

  if (!periode_id) {
    return NextResponse.json(
      { error: "periode_id ontbreekt" },
      { status: 400 }
    );
  }

  const { rows } = await db.query(
    `
    SELECT
      m.naam,
      COUNT(*) AS totaal,
      COUNT(*) FILTER (WHERE t.shift_nr = 1) AS shift_1,
      COUNT(*) FILTER (WHERE t.shift_nr = 2) AS shift_2
    FROM planning_toewijzingen t
    JOIN medewerkers m ON m.email = t.medewerker_email
    WHERE t.periode_id = $1
    GROUP BY m.naam
    ORDER BY totaal DESC, m.naam
    `,
    [periode_id]
  );

  return NextResponse.json(rows);
}