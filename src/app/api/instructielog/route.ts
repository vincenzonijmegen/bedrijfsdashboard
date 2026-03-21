import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const email = body.email;
    const instructie_id = body.instructie_id;
    const duur = Math.max(1, Number(body.duur_seconden) || 0);

    if (!email || !instructie_id) {
      return NextResponse.json(
        { error: "email en instructie_id zijn verplicht" },
        { status: 400 }
      );
    }

    await db.query(
      `UPDATE gelezen_instructies
       SET gelezen_duur_seconden = $1
       WHERE email = $2 AND instructie_id = $3`,
      [duur, email, instructie_id]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Fout bij loggen van leesduur:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}