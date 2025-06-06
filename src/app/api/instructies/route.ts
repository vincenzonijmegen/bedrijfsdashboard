import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres"; // of je eigen db client
import slugify from "slugify"; // let op: installeer met `npm install slugify`

export async function POST(req: Request) {
  try {
    const { titel, inhoud } = await req.json();
    if (!titel || !inhoud) {
      return NextResponse.json({ error: "Titel of inhoud ontbreekt" }, { status: 400 });
    }

    const slug = slugify(titel, { lower: true, strict: true });
    const created_at = new Date().toISOString();

    await sql`
      INSERT INTO instructies (titel, inhoud, slug, status, created_at)
      VALUES (${titel}, ${inhoud}, ${slug}, 'concept', ${created_at})
    `;

    return NextResponse.json({ slug }, { status: 200 });
  } catch (err) {
    console.error("Fout bij opslaan instructie:", err);
    return NextResponse.json({ error: "Interne fout" }, { status: 500 });
  }
}
