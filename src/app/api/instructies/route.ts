import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import slugify from "slugify";

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
    console.error("🛑 Fout bij POST:", err);
    return NextResponse.json({ error: "Fout bij opslaan" }, { status: 500 });
  }
}
