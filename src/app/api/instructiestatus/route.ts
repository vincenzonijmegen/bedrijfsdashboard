import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email");

  console.log("📡 instructiestatus GET gestart", email);

  if (!email) {
    return NextResponse.json({ error: "Email ontbreekt" }, { status: 400 });
  }

  try {
    const instructieRes = await db.query(`SELECT id, slug FROM instructies`);
    console.log("✅ instructies geladen:", instructieRes.rows.length);

    const instructieMap = new Map(instructieRes.rows.map((r) => [r.id, r.slug]));

    const gelezenRes = await db.query(
      `SELECT instructie_id FROM gelezen_instructies WHERE user_email = $1`,
      [email]
    );
    console.log("✅ gelezen instructies:", gelezenRes.rows);

    const gelezenSlugs = new Set(
      gelezenRes.rows
        .map((r) => {
          const slug = instructieMap.get(r.instructie_id);
          if (!slug) console.warn("⚠️ Geen slug gevonden voor:", r.instructie_id);
          return slug;
        })
        .filter((slug): slug is string => Boolean(slug))
    );

    const toetsRes = await db.query(
      `SELECT slug, score, totaal FROM toetsresultaten WHERE email = $1`,
      [email]
    );
    const toetsMap = new Map(toetsRes.rows.map((r) => [r.slug, { score: r.score, totaal: r.totaal }]));

    const alleSlugs = new Set([...gelezenSlugs, ...toetsMap.keys()]);

    const status = Array.from(alleSlugs).map((slug) => ({
      slug,
      gelezen: gelezenSlugs.has(slug),
      ...toetsMap.get(slug),
    }));

    return NextResponse.json(status);
  } catch (err) {
    console.error("❌ Fout in instructiestatus GET:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}
