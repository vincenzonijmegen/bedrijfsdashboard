import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Slaat de volgorde op van acties in de opgegeven lijst
export async function POST(req: Request) {
  const { ids } = await req.json(); // [{id, volgorde}, ...]
  if (!Array.isArray(ids)) {
    return NextResponse.json({ error: "Geen geldige ids-array" }, { status: 400 });
  }
  for (const { id, volgorde } of ids) {
    await db.query("UPDATE acties SET volgorde=$1 WHERE id=$2", [volgorde, id]);
  }
  return NextResponse.json({ ok: true });
}
