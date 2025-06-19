import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { email, instructie_id, duur_seconden } = await req.json();

  try {
    await db.query(
      `UPDATE gelezen_instructies
       SET gelezen_duur_seconden = $1
       WHERE email = $2 AND instructie_id = $3`,
      [duur_seconden, email, instructie_id]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Fout bij loggen van leessduur:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
