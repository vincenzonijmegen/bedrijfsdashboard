import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const result = await db.query(`
    SELECT id, voornaam, achternaam, email, telefoon, status, aangemaakt_op
    FROM sollicitaties
    ORDER BY aangemaakt_op DESC
  `);

  return NextResponse.json(result.rows);
}