// /app/api/shift-acties/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const result = await db.query("SELECT * FROM shift_acties ORDER BY datum DESC");
    return NextResponse.json(result.rows);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { datum, shift, tijd, van, naar, type, bron_email } = body;

    await db.query(
      `INSERT INTO shift_acties (datum, shift, tijd, van, naar, type, bron_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [datum, shift, tijd, van, naar, type, bron_email]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
