// src/app/api/instructies/route.ts
import { NextResponse } from "next/server";
import slugify from "slugify";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { titel, inhoud } = await req.json();
    const slug = slugify(titel, { lower: true, strict: true });
    const created_at = new Date().toISOString();

    await db.query(
      `INSERT INTO instructies (titel, inhoud, slug, status, created_at)
       VALUES ($1, $2, $3, 'concept', $4)`,
      [titel, inhoud, slug, created_at]
    );

    return NextResponse.json({ slug }, { status: 200 });
  } catch (err) {
    console.error("🛑 DB-fout:", err);
    return NextResponse.json({ error: "Databasefout" }, { status: 500 });
  }
}
