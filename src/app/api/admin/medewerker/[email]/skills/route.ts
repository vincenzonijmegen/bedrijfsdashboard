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
              st.status,
              st.ingevuld_op,
              st.begeleider
       FROM skill_status st
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
