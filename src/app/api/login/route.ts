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

// 2. API route: /api/medewerkers/route.ts - aanmaken en ophalen van medewerkers
export async function GET() {
  const result = await db.query("SELECT naam, email, functie FROM medewerkers ORDER BY naam");
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const { naam, email, functie, wachtwoord } = await req.json();

  try {
    await db.query(
      `INSERT INTO medewerkers (naam, email, functie, wachtwoord) VALUES ($1, $2, $3, $4)`,
      [naam, email, functie, wachtwoord]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Fout bij toevoegen medewerker:", err);
    return NextResponse.json({ success: false, error: "Toevoegen mislukt" }, { status: 500 });
  }
}
