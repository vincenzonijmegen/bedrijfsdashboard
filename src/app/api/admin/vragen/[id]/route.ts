// 📄 Bestand: src/app/api/admin/vragen/[id]/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";

function isLeiding(functie: string) {
  return ["eigenaar", "leiding"].includes(functie.toLowerCase());
}

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  try {
    const payload = verifyJWT(req);
    if (!isLeiding(payload.functie ?? "")) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    const vraagId = parseInt(context.params.id, 10);
    const body = await req.json();
    const antwoord = body.antwoord?.trim();
    if (!antwoord) return NextResponse.json({ error: "Antwoord is verplicht" }, { status: 400 });

    const { rows } = await db.query(
      `UPDATE vragen
       SET antwoord = $1, beantwoord_op = NOW(), status = 'beantwoord'
       WHERE id = $2
       RETURNING id, vraag, antwoord, aangemaakt_op`,
      [antwoord, vraagId]
    );

    return NextResponse.json(rows[0]);
  } catch (err) {
    return NextResponse.json({ error: "Serverfout of niet ingelogd" }, { status: 500 });
  }
}
