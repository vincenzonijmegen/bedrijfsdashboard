// src/app/api/dossier/document/route.ts

import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ url: null });

  const result = await db.query(`
    SELECT url
    FROM personeelsdocumenten
    WHERE medewerker_email = $1
    ORDER BY toegevoegd_op DESC
    LIMIT 1
  `, [email]);

  return NextResponse.json({ url: result.rows[0]?.url || null });
}
