import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const result = await db.query(
    `SELECT * FROM sollicitaties WHERE id = $1`,
    [id]
  );

  return NextResponse.json(result.rows[0]);
}