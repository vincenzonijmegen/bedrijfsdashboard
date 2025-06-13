// 1. API route: /api/login/route.ts - controleer login op basis van medewerkers
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { email, wachtwoord } = await req.json();

  const result = await db.query(
    `SELECT * FROM medewerkers WHERE email = $1 AND wachtwoord = $2`,
    [email, wachtwoord]
  );

  if (result.rowCount === 1) {
    const medewerker = result.rows[0];
    return NextResponse.json({
      success: true,
      naam: medewerker.naam,
      functie: medewerker.functie,
      email: medewerker.email,
    });
  } else {
    return NextResponse.json({ success: false, error: "Ongeldige inloggegevens" }, { status: 401 });
  }
}

