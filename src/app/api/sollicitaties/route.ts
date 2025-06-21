// app/api/sollicitaties/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db"; // Zorg dat dit naar jouw database instance wijst

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    await db.query(`INSERT INTO sollicitaties (...) VALUES (...)`, [...]); // result verwijderd omdat het niet gebruikt wordt

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Fout bij POST /api/sollicitaties", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
