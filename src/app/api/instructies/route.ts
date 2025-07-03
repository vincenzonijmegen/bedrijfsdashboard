import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import slugify from "slugify";



export async function POST(req: Request) {
  try {
    
    const { titel, inhoud, nummer, functies } = await req.json();
    const slug = slugify(titel, { lower: true, strict: true });
    const created_at = new Date().toISOString();

    const functiesGeparsed = Array.isArray(functies)
  ? functies
  : typeof functies === "string"
  ? (() => {
      try {
        return JSON.parse(functies);
      } catch {
        return [];
      }
    })()
  : [];

await db.query(
  `INSERT INTO instructies (titel, inhoud, slug, status, created_at, nummer, functies)
   VALUES ($1, $2, $3, 'concept', $4, $5, $6)`,
  [titel, inhoud, slug, created_at, nummer, JSON.stringify(functiesGeparsed)]
    );

    return new NextResponse(JSON.stringify({ slug }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("🛑 Fout bij POST:", err);
    return NextResponse.json({ error: "Fout bij opslaan" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const result = await db.query(
      "SELECT id, titel, slug, nummer, functies FROM instructies ORDER BY created_at DESC"
    );
    return NextResponse.json(result.rows, { status: 200 });
  } catch (err) {
    console.error("🛑 Fout bij ophalen instructies:", err);
    return NextResponse.json({ error: "Fout bij ophalen" }, { status: 500 });
  }
}
