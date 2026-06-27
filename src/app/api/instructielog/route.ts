import { db } from "@/lib/db";
import { verifyJWT } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const TOEGESTANE_SCHRIJFROLLEN = ["beheerder"];

async function magSchrijven(req: NextRequest) {
  try {
    const gebruikerJWT = verifyJWT(req);

    const result = await db.query(
      `SELECT rol
       FROM medewerkers
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [gebruikerJWT.email]
    );

    const gebruiker = result.rows[0];

    if (!gebruiker) {
      return false;
    }

    const rol = String(gebruiker.rol || "").toLowerCase();

    return TOEGESTANE_SCHRIJFROLLEN.includes(rol);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const toegestaan = await magSchrijven(req);

    if (!toegestaan) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

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
       WHERE lower(email) = lower($2)
         AND instructie_id = $3`,
      [duur, email, instructie_id]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Fout bij loggen van leesduur:", err);

    return NextResponse.json(
      { error: "Loggen van leesduur mislukt." },
      { status: 500 }
    );
  }
}