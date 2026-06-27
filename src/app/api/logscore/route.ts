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

    const data = await req.json();

    const { email, score, aantalJuist, totaal, tijdstip, slug } = data;

    if (!email || !slug || !tijdstip) {
      return NextResponse.json(
        { error: "Verplichte velden ontbreken" },
        { status: 400 }
      );
    }

    await db.query(
      `INSERT INTO toetsresultaten
        (email, score, juist, totaal, tijdstip, slug)
       VALUES
        ($1, $2, $3, $4, $5, $6)`,
      [
        email,
        Number(score),
        Number(aantalJuist),
        Number(totaal),
        tijdstip,
        slug,
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ Fout in /api/logscore:", err);

    return NextResponse.json(
      { error: "Opslaan score mislukt." },
      { status: 500 }
    );
  }
}