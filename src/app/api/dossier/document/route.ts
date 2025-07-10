// src/app/api/dossier/document/route.ts

// src/app/api/dossier/document/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Email ontbreekt" }, { status: 400 });
  }

  const documenten = await db.query(
    "SELECT bestand_url FROM personeelsdocumenten WHERE email = $1",
    [email]
  );

  return NextResponse.json(documenten.rows);
}
