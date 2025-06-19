import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// POST: sla op dat een instructie is gelezen door een gebruiker
export async function POST(req: NextRequest) {
  const { email, instructie_id } = await req.json();

  try {
    await db.query(
      `INSERT INTO gelezen_instructies (email, instructie_id)
       VALUES ($1, $2)
       ON CONFLICT (email, instructie_id) DO NOTHING`,
      [email, instructie_id]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Fout bij opslaan gelezen status:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET: geef lijst van gelezen instructies (met eventuele score) voor een specifieke gebruiker
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const email = searchParams.get("email");

  try {
    const result = await db.query(
      `SELECT g.instructie_id, i.slug, i.titel, g.gelezen_op,
              r.score, r.juist, r.totaal
       FROM gelezen_instructies g
       JOIN instructies i ON g.instructie_id = i.id
       LEFT JOIN toetsresultaten r
         ON r.instructie_id = g.instructie_id AND r.email = g.email
       WHERE g.email = $1
       ORDER BY g.gelezen_op DESC`,
      [email]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("❌ Fout bij ophalen gelezen instructies:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
