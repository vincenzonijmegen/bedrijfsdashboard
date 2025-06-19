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
    const result = await db.query(
      `SELECT i.slug,
              CASE WHEN g.instructie_id IS NOT NULL THEN TRUE ELSE FALSE END AS gelezen,
              t.score,
              t.totaal
       FROM instructies i
       LEFT JOIN gelezen_instructies g ON g.instructie_id = i.id AND g.user_email = $1
       LEFT JOIN toetsresultaten t ON t.instructie_id = i.id AND t.email = $1`,
      [email]
    );

    console.log("✅ Resultaten ontvangen:", result.rows);

    const status = result.rows.map((r) => ({
      slug: r.slug,
      gelezen: !!r.gelezen,
      score: r.score ?? undefined,
      totaal: r.totaal ?? undefined,
    }));

    return NextResponse.json(status);
  } // eslint-disable-next-line @typescript-eslint/no-explicit-any
  catch (err: any) {
    console.error("❌ Fout in instructiestatus GET:", err.message || err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}
