// 📄 Bestand: src/app/api/admin/vragen/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";

function isLeiding(functie: string) {
  return ["eigenaar", "leiding", "beheerder"].includes(functie.toLowerCase());
}

export async function GET(req: NextRequest) {
  try {
    const payload = verifyJWT(req);
    console.log("JWT payload:", payload);

    if (!isLeiding(payload.functie ?? "")) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    const { rows } = await db.query(
      `SELECT v.id, v.vraag, v.antwoord, v.aangemaakt_op, m.naam, m.email
       FROM vragen v
       JOIN medewerkers m ON v.medewerker_id = m.id
       ORDER BY v.aangemaakt_op DESC`
    );

    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
}
