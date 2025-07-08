import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const gebruikerJWT = verifyJWT(req); // ✅ werkt nu correct

    const result = await db.query(
      `SELECT naam, email, functie FROM medewerkers WHERE email = $1`,
      [gebruikerJWT.email]
    );

    const gebruiker = result.rows[0];
    if (!gebruiker) {
      return NextResponse.json({ error: "Gebruiker niet gevonden" }, { status: 404 });
    }

    return NextResponse.json({
      naam: gebruiker.naam,
      email: gebruiker.email,
      functie: gebruiker.functie,
    });
  } catch (err) {
    return NextResponse.json({ error: "Niet ingelogd of sessie ongeldig" }, { status: 401 });
  }
}
