import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// POST: registreer 'gelezen'
export async function POST(req: Request) {
  const { email, instructie_id } = await req.json();

  if (!email || !instructie_id) {
    return NextResponse.json({ error: "email en instructie_id zijn vereist" }, { status: 400 });
  }

  try {
    await db.query(
      `INSERT INTO gelezen_instructies (user_email, instructie_id, gelezen_op) VALUES ($1, $2, NOW())
       ON CONFLICT (user_email, instructie_id) DO NOTHING`,
      [email, instructie_id]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Fout bij opslaan gelezen instructie:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Email ontbreekt" }, { status: 400 });
  }

  try {
    // Stap 1: Alle instructies ophalen (id + slug)
    const instructieRes = await db.query(`SELECT id, slug FROM instructies`);
    const instructieMap = new Map(instructieRes.rows.map((r) => [r.id, r.slug]));

    // Stap 2: Gelezen instructies koppelen via instructie_id
    const gelezenRes = await db.query(
      `SELECT instructie_id FROM gelezen_instructies WHERE user_email = $1`,
      [email]
    );
    const gelezenSlugs = new Set(
      gelezenRes.rows
        .map((r) => instructieMap.get(r.instructie_id))
        .filter((slug): slug is string => Boolean(slug))
    );

    // Stap 3: Toetsresultaten ophalen (gebruiken slug)
    const toetsRes = await db.query(
      `SELECT slug, score, totaal FROM toetsresultaten WHERE email = $1`,
      [email]
    );
    const toetsMap = new Map(toetsRes.rows.map((r) => [r.slug, { score: r.score, totaal: r.totaal }]));

    // Stap 4: Alle bekende slugs combineren
    const alleSlugs = new Set([...gelezenSlugs, ...toetsMap.keys()]);

    const status = Array.from(alleSlugs).map((slug) => ({
      slug,
      gelezen: gelezenSlugs.has(slug),
      ...toetsMap.get(slug),
    }));

    return NextResponse.json(status);
  } catch (err) {
    console.error("Fout bij ophalen instructiestatus:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}
