import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  try {
    const result = await db.query("SELECT * FROM instructies WHERE slug = $1", [params.slug]);
    if (result.rows.length === 0)
      return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (err) {
    console.error("🛑 Fout bij GET:", err);
    return NextResponse.json({ error: "Databasefout" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  try {
    const { titel, inhoud } = await req.json();
    await db.query(
      `UPDATE instructies SET titel = $1, inhoud = $2 WHERE slug = $3`,
      [titel, inhoud, params.slug]
    );
    return NextResponse.json({ slug: params.slug }, { status: 200 });
  } catch (err) {
    console.error("🛑 Fout bij PATCH:", err);
    return NextResponse.json({ error: "Update mislukt" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { slug: string } }) {
  try {
    await db.query(`DELETE FROM instructies WHERE slug = $1`, [params.slug]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("🛑 Fout bij DELETE:", err);
    return NextResponse.json({ error: "Verwijderen mislukt" }, { status: 500 });
  }
}
