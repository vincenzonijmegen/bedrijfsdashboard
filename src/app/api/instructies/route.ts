import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function GET() {
  try {
    const result = await query(
      "SELECT id, titel, inhoud FROM instructies ORDER BY gepubliceerd_op DESC"
    );
    return NextResponse.json(result.rows);
  } catch (err: unknown) {
  if (err instanceof Error) {
    console.error("❌ FOUT in GET instructies:", err.message);
  } else {
    console.error("❌ Onbekende fout:", err);
  }

    return NextResponse.json({ error: "Fout bij ophalen instructies" }, { status: 500 });
  }
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function POST(req: NextRequest) {
  try {
    const { titel, inhoud } = await req.json();
    if (!titel || !inhoud) throw new Error("Titel of inhoud ontbreekt");

    const result = await query(
      "INSERT INTO instructies (titel, inhoud) VALUES ($1, $2) RETURNING *",
      [titel, inhoud]
    );

    return NextResponse.json({ status: "ok", instructie: result.rows[0] });

} catch (err: unknown) {
  if (err instanceof Error) {
    console.error("❌ FOUT in POST instructies:", err.message);
  } else {
    console.error("❌ Onbekende fout:", err);
  }

    return NextResponse.json({ error: "Fout bij opslaan instructie" }, { status: 500 });
  }
}
