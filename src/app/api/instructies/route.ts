import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const result = await query(
    "SELECT id, titel, inhoud FROM instructies ORDER BY gepubliceerd_op DESC"
  );
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const { titel, inhoud } = await req.json();
  const result = await query(
    "INSERT INTO instructies (titel, inhoud) VALUES ($1, $2) RETURNING *",
    [titel, inhoud]
  );
  return NextResponse.json({ status: "ok", instructie: result.rows[0] });
}
