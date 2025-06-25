// src/app/api/gelezen/route.ts

// Deze oude route gebruikt waarschijnlijk nog postgres() of een sql-client die je niet meer gebruikt.
// Verwijder alle verwijzingen naar 'postgres' en gebruik alleen je eigen 'db.query'.

import { NextResponse } from "next/server";
import { db } from "@/lib/db"; // jouw pg Pool

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body || !body.email || !body.instructie_id) {
      return NextResponse.json({ error: "Ongeldige invoer" }, { status: 400 });
    }

    await db.query(
      `INSERT INTO gelezen_instructies (email, instructie_id, gelezen_op)
       VALUES ($1, $2, NOW())
       ON CONFLICT (email, instructie_id) DO NOTHING`,
      [body.email, body.instructie_id]
    );

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("❌ Fout in /api/gelezen:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}
