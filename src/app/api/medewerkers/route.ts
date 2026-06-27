import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  if (type === "functies") {
    const result = await db.query("SELECT id, naam FROM functies ORDER BY naam");
    return NextResponse.json(result.rows);
  }

  const result = await db.query(
    "SELECT id, naam, email, functie FROM medewerkers ORDER BY naam"
  );

  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const { naam, email, functie } = await req.json();

  try {
    const check = await db.query("SELECT 1 FROM medewerkers WHERE email = $1", [
      email,
    ]);

    if (check && check.rowCount && check.rowCount > 0) {
      return NextResponse.json(
        { success: false, error: "E-mailadres bestaat al" },
        { status: 400 }
      );
    }

    /*
      Medewerkers gebruiken de werkinstructies inmiddels via onboardingmails
      met een unieke token/hash. Ze hoeven dus geen wachtwoord of accountmail
      meer te ontvangen.

      We vullen wachtwoord nog wel technisch met een onbekend random wachtwoord,
      zodat bestaande databasekolommen zoals wachtwoord NOT NULL geen deployment
      kapotmaken.
    */
    const verborgenWachtwoord = crypto.randomUUID();
    const hashedWachtwoord = await bcrypt.hash(verborgenWachtwoord, 10);

    await db.query(
      `INSERT INTO medewerkers 
        (naam, email, functie, wachtwoord, moet_wachtwoord_wijzigen) 
       VALUES 
        ($1, $2, $3, $4, false)`,
      [naam, email, functie, hashedWachtwoord]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Fout bij toevoegen medewerker:", err);
    return NextResponse.json(
      { success: false, error: "Toevoegen mislukt" },
      { status: 500 }
    );
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
    return NextResponse.json(
      { success: false, error: "Verwijderen mislukt" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, naam, email, functie: functieId } = body;

    if (!id || !naam || !email || !functieId) {
      return NextResponse.json({ error: "Vul alle velden in." }, { status: 400 });
    }

    await db.query(
      `UPDATE medewerkers
       SET naam = $1,
           email = $2,
           functie = $3
       WHERE id = $4`,
      [naam, email, functieId, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fout bij bijwerken medewerker:", error);
    return NextResponse.json({ error: "Interne serverfout" }, { status: 500 });
  }
}