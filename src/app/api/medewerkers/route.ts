import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sendUitnodiging } from "@/lib/mail";


export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  if (type === "functies") {
    const result = await db.query("SELECT id, naam FROM functies ORDER BY naam");
    return NextResponse.json(result.rows);
  }

  const result = await db.query("SELECT naam, email, functie FROM medewerkers ORDER BY naam");
  return NextResponse.json(result.rows);
}


export async function POST(req: Request) {
  const { naam, email, functie } = await req.json();

  try {
    // controleer op bestaand e-mailadres
    const check = await db.query("SELECT 1 FROM medewerkers WHERE email = $1", [email]);
    if (check && check.rowCount && check.rowCount > 0) {
      return NextResponse.json({ success: false, error: "E-mailadres bestaat al" }, { status: 400 });
    }

    // tijdelijk wachtwoord genereren + hashen
    const tijdelijkWachtwoord = Math.random().toString(36).slice(-8);
    const hashedWachtwoord = await bcrypt.hash(tijdelijkWachtwoord, 10);

    // opslaan in database
await db.query(
  `INSERT INTO medewerkers (naam, email, functie, wachtwoord, moet_wachtwoord_wijzigen) VALUES ($1, $2, $3, $4, true)`,
  [naam, email, functie, hashedWachtwoord]
);
    console.log("📨 Stuur uitnodiging naar:", email);

    // uitnodiging versturen
    await sendUitnodiging(email, naam, tijdelijkWachtwoord);
    console.log("📬 Resend aanroep:", { email, naam, tijdelijkWachtwoord });

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
