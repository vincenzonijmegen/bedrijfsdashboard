// src/app/api/admin/instructiestatus/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { rows } = await db.query(
    `SELECT email, gelezen_op, score, totaal, juist FROM instructiestatus`
  );
  return NextResponse.json(rows);
}
