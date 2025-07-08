import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { email: string } }
) {
  const email = decodeURIComponent(params.email);

  try {
    const { rows } = await db.query(
      `SELECT st.skill_id,
              s.naam,
              COALESCE(ss.status, 'niet_geleerd') AS status,
              ss.ingevuld_op,
              ss.begeleider
       FROM skill_toegewezen st
       LEFT JOIN skill_status ss ON ss.skill_id = st.skill_id AND ss.medewerker_id = st.medewerker_id
       JOIN skills s ON s.id = st.skill_id
       WHERE st.medewerker_id::text = $1
       ORDER BY s.naam`,
      [email]
    );

    return NextResponse.json(rows);
  } catch (err: any) {
    console.error("Fout bij ophalen skills medewerker:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
