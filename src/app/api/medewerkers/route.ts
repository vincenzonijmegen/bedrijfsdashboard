import { db } from "@/lib/db";
import { sendUitnodiging } from "@/lib/mail";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  if (type === "functies") {
    const result = await db.query("SELECT id, naam FROM functies ORDER BY naam");
    return NextResponse.json(result.rows);
  }

  const result = await db.query(
    `SELECT id, naam, email, functie, geboortedatum
     FROM medewerkers
     ORDER BY naam`
  );

  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { naam, email, functie, geboortedatum } = body;

    if (!naam || !email || !functie) {
      return NextResponse.json(
        { success: false, error: "Naam, e-mail en functie zijn verplicht." },
        { status: 400 }
      );
    }

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
      Medewerkers gebruiken de werkinstructies via onboardingmails
      met een persoonlijke link. Ze hebben dus geen zichtbaar wachtwoord
      of accountmail meer nodig.

      We slaan nog wel technisch een onbekend random wachtwoord op,
      zodat bestaande databasekolommen zoals wachtwoord NOT NULL
      geen fout geven.
    */
    const verborgenWachtwoord = crypto.randomUUID();
    const hashedWachtwoord = await bcrypt.hash(verborgenWachtwoord, 10);

    await db.query(
      `INSERT INTO medewerkers
        (naam, email, functie, wachtwoord, moet_wachtwoord_wijzigen, geboortedatum)
       VALUES
        ($1, $2, $3, $4, false, $5)`,
      [naam, email, functie, hashedWachtwoord, geboortedatum || null]
    );

    let mailVerstuurd = false;

    try {
      await sendUitnodiging(email, naam);
      mailVerstuurd = true;
    } catch (mailError) {
      console.error("Medewerker aangemaakt, maar welkomstmail mislukt:", mailError);
    }

    return NextResponse.json({
      success: true,
      mailVerstuurd,
    });
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
    const { id, naam, email, functie: functieId, geboortedatum } = body;

    if (!id || !naam || !email || !functieId) {
      return NextResponse.json(
        { error: "Vul alle verplichte velden in." },
        { status: 400 }
      );
    }

    await db.query(
      `UPDATE medewerkers
       SET naam = $1,
           email = $2,
           functie = $3,
           geboortedatum = $4
       WHERE id = $5`,
      [naam, email, functieId, geboortedatum || null, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fout bij bijwerken medewerker:", error);

    return NextResponse.json(
      { error: "Interne serverfout" },
      { status: 500 }
    );
  }
}