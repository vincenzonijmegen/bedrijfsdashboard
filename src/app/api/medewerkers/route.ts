import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await db.query("SELECT naam, email, functie FROM medewerkers ORDER BY naam");
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const { naam, email, functie, wachtwoord } = await req.json();

  try {
    // controleer op bestaand e-mailadres
    const check = await db.query("SELECT 1 FROM medewerkers WHERE email = $1", [email]);
    if (check.rowCount > 0) {
      return NextResponse.json({ success: false, error: "E-mailadres bestaat al" }, { status: 400 });
    }

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

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Email is vereist" }, { status: 400 });
  }

  try {
    await db.query(`DELETE FROM medewerkers WHERE email = $1`, [email]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Fout bij verwijderen medewerker:", err);
    return NextResponse.json({ success: false, error: "Verwijderen mislukt" }, { status: 500 });
  }
}
