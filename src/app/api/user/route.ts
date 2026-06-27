import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { db } from "@/lib/db";

const TOEGESTANE_ROLLEN = ["beheerder", "accountant"];

export async function GET(req: NextRequest) {
  try {
    const gebruikerJWT = verifyJWT(req);

    const result = await db.query(
      `SELECT naam, email, functie, rol
       FROM medewerkers
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [gebruikerJWT.email]
    );

    const gebruiker = result.rows[0];

    if (!gebruiker) {
      return NextResponse.json(
        { error: "Gebruiker niet gevonden" },
        { status: 404 }
      );
    }

    const rol = String(gebruiker.rol || "").toLowerCase();

    if (!TOEGESTANE_ROLLEN.includes(rol)) {
      return NextResponse.json(
        { error: "Geen toegang" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      naam: gebruiker.naam,
      email: gebruiker.email,
      functie: gebruiker.functie,
      rol,
    });
  } catch {
    return NextResponse.json(
      { error: "Niet ingelogd of sessie ongeldig" },
      { status: 401 }
    );
  }
}