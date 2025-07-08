import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { email: string } }
) {
  const email = decodeURIComponent(params.email);

  try {
    const gelezen = await db.query(
      `SELECT gi.instructie_id,
              i.titel,
              gi.gelezen_op,
              gi.gelezen_duur_seconden,
              gi.versie_gezien,
              i.versie
       FROM gelezen_instructies gi
       JOIN instructies i ON i.id = gi.instructie_id
       WHERE gi.email = $1
       ORDER BY i.nummer, i.titel`,
      [email]
    );

    const toetsen = await db.query(
      `SELECT instructie_id, score, juist, totaal, tijdstip
       FROM toetsresultaten
       WHERE email = $1
       ORDER BY tijdstip DESC`,
      [email]
    );

    return NextResponse.json({ gelezen: gelezen.rows, toetsen: toetsen.rows });
  } catch (err: any) {
    console.error("Fout bij ophalen instructies medewerker:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
