import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const periode_id = req.nextUrl.searchParams.get("periode_id");

  const { rows } = await db.query(
    `SELECT medewerker_email, datum
     FROM planning_afwezigheid
     WHERE periode_id = $1`,
    [periode_id]
  );

  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest) {
  const { periode_id, items } = await req.json();

  await db.query(
    `DELETE FROM planning_afwezigheid WHERE periode_id = $1`,
    [periode_id]
  );

  for (const i of items) {
    await db.query(
      `INSERT INTO planning_afwezigheid (periode_id, medewerker_email, datum)
       VALUES ($1, $2, $3::date)`,
      [periode_id, i.email, i.datum]
    );
  }

  return NextResponse.json({ success: true });
}