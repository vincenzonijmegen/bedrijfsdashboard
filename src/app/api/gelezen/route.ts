import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyJWT } from "@/lib/auth";

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

    const { instructieId, email } = await req.json();

    if (!instructieId || !email) {
      return NextResponse.json(
        { error: "Ongeldige invoer" },
        { status: 400 }
      );
    }

    await db.query(
      `INSERT INTO gelezen_instructies
        (gebruiker_email, instructie_id)
       VALUES
        ($1, $2)
       ON CONFLICT DO NOTHING`,
      [email, instructieId]
    );

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("❌ FOUT bij opslaan gelezen instructie:", err);

    return NextResponse.json(
      { error: "Fout bij opslaan" },
      { status: 500 }
    );
  }
}