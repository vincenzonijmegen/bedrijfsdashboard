import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import slugify from "slugify";

export async function POST(req: NextRequest) {
  try {
    const { titel, inhoud, nummer, functies } = await req.json();
    const slug = slugify(titel, { lower: true, strict: true });
    const createdAt = new Date().toISOString();

    // Zorg dat functies een array is
    let functiesArray: string[] = [];
    if (Array.isArray(functies)) {
      functiesArray = functies;
    } else if (typeof functies === 'string') {
      try {
        functiesArray = JSON.parse(functies);
      } catch {
        console.warn('Kon functies niet parsen, verwacht JSON-array string');
      }
    }

    await db.query(
      `INSERT INTO instructies (titel, inhoud, slug, status, created_at, nummer, functies)
       VALUES ($1, $2, $3, 'concept', $4, $5, $6)`,
      [titel, inhoud, slug, createdAt, nummer, JSON.stringify(functiesArray)]
    );

    return NextResponse.json({ slug });
  } catch (err) {
    console.error("🛑 Fout bij POST /api/instructies:", err);
    return NextResponse.json({ error: "Fout bij opslaan instructie" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email');
    if (!email) {
      // Geen email, geef lege lijst
      return NextResponse.json([]);
    }

    // Haal functie op van deze medewerker
    const functieRes = await db.query(
      `SELECT functie FROM medewerkers WHERE email = $1 LIMIT 1`,
      [email]
    );
    const functie = functieRes.rows[0]?.functie;
    if (!functie) {
      return NextResponse.json([]);
    }

    // Haal actieve instructies voor deze functie
    const result = await db.query(
      `SELECT id, titel, slug, nummer, functies
       FROM instructies
       WHERE status = 'actief'
         AND functies @> $1::jsonb
       ORDER BY created_at DESC`,
      [JSON.stringify([functie])]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("🛑 Fout bij GET /api/instructies:", err);
    return NextResponse.json({ error: "Fout bij ophalen instructies" }, { status: 500 });
  }
}
