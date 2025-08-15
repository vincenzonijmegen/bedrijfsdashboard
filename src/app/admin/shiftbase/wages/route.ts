import { NextResponse } from "next/server";
import { db } from "@/lib/db"; // jouw pg client/pooled connection

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // Variant A: als je een tabel hebt met shiftbase_user_id + uurloon
    // const rows = await db.query(`
    //   SELECT shiftbase_user_id AS user_id, uurloon AS wage
    //   FROM medewerkers
    //   WHERE uurloon IS NOT NULL AND uurloon > 0
    // `);

    // Variant B: als je user_id exact gelijk is aan Shiftbase user_id
    const rows = await db.query(`
      SELECT user_id, uurloon AS wage
      FROM medewerkers
      WHERE uurloon IS NOT NULL AND uurloon > 0
    `);

    return NextResponse.json({ data: rows.rows });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Kon lonen niet ophalen", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
