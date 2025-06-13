import { db } from "@/lib/db";
import { NextResponse } from "next/server";

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
