import { pool, db } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sendUitnodiging } from "@/lib/mail";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  if (type === "functies") {
    const result = await db.query(
      "SELECT id, naam FROM functies ORDER BY naam"
    );

    return NextResponse.json(result.rows);
  }

  const result = await db.query(
    `SELECT id, naam, email, functie
     FROM medewerkers
     ORDER BY naam`
  );

  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const { naam, email, functie } = await req.json();

  try {
    const genormaliseerdEmail = String(email).trim().toLowerCase();

    const check = await db.query(
      `SELECT 1
       FROM medewerkers
       WHERE lower(email) = lower($1)`,
      [genormaliseerdEmail]
    );

    if (check.rowCount && check.rowCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "E-mailadres bestaat al",
        },
        { status: 400 }
      );
    }

    const tijdelijkWachtwoord = Math.random().toString(36).slice(-8);
    const hashedWachtwoord = await bcrypt.hash(tijdelijkWachtwoord, 10);

    await db.query(
      `INSERT INTO medewerkers (
        naam,
        email,
        functie,
        wachtwoord,
        moet_wachtwoord_wijzigen
      )
      VALUES ($1, $2, $3, $4, true)`,
      [
        String(naam).trim(),
        genormaliseerdEmail,
        String(functie).trim(),
        hashedWachtwoord,
      ]
    );

    await sendUitnodiging(
      genormaliseerdEmail,
      String(naam).trim(),
      tijdelijkWachtwoord
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Fout bij toevoegen medewerker:", err);

    return NextResponse.json(
      {
        success: false,
        error: "Toevoegen mislukt",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const emailParameter = searchParams.get("email");

  if (!emailParameter) {
    return NextResponse.json(
      {
        success: false,
        error: "E-mailadres is vereist",
      },
      { status: 400 }
    );
  }

  const email = emailParameter.trim().toLowerCase();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const medewerkerResultaat = await client.query(
      `SELECT id, naam, email
       FROM medewerkers
       WHERE lower(email) = lower($1)
       FOR UPDATE`,
      [email]
    );

    if (medewerkerResultaat.rowCount === 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          error: "Medewerker niet gevonden",
        },
        { status: 404 }
      );
    }

    const medewerker = medewerkerResultaat.rows[0];
    const medewerkerId = medewerker.id;
    const opgeslagenEmail = medewerker.email;

    /*
     * Tabellen zonder ON DELETE CASCADE.
     */
    await client.query(
      `DELETE FROM beschikbaarheid_basis
       WHERE medewerker_id = $1`,
      [medewerkerId]
    );

    /*
     * Tabellen die via e-mailadres aan de medewerker zijn gekoppeld.
     */
    await client.query(
      `DELETE FROM toetsresultaten
       WHERE lower(email) = lower($1)`,
      [opgeslagenEmail]
    );

    await client.query(
      `DELETE FROM gelezen_instructies
       WHERE lower(email) = lower($1)`,
      [opgeslagenEmail]
    );

    await client.query(
      `DELETE FROM onboarding_opdrachten
       WHERE lower(medewerker_email) = lower($1)`,
      [opgeslagenEmail]
    );

    /*
     * Expliciet opruimen van skillgegevens.
     * Deze tabellen hebben ON DELETE CASCADE, maar expliciet verwijderen
     * maakt duidelijk welke gegevens bij de verwijderactie horen.
     */
    await client.query(
      `DELETE FROM skill_status
       WHERE medewerker_id = $1`,
      [medewerkerId]
    );

    await client.query(
      `DELETE FROM skill_toegewezen
       WHERE medewerker_id = $1`,
      [medewerkerId]
    );

    /*
     * medewerker_skills.medewerker_id heeft ON DELETE CASCADE.
     * planning_afwezigheid en planning_toewijzingen hebben CASCADE.
     * ziekteverzuim heeft eveneens CASCADE.
     *
     * medewerker_skills.toegevoegd_door en vragen.medewerker_id hebben
     * geen CASCADE. Als daar historie aan hangt, stoppen we de verwijdering
     * bewust en melden we welke blokkades er zijn.
     */
    const skillBeheerResultaat = await client.query(
      `SELECT COUNT(*)::integer AS aantal
       FROM medewerker_skills
       WHERE toegevoegd_door = $1`,
      [medewerkerId]
    );

    const vragenResultaat = await client.query(
      `SELECT COUNT(*)::integer AS aantal
       FROM vragen
       WHERE medewerker_id = $1`,
      [medewerkerId]
    );

    const aantalSkillBeheer =
      skillBeheerResultaat.rows[0]?.aantal ?? 0;

    const aantalVragen =
      vragenResultaat.rows[0]?.aantal ?? 0;

    if (aantalSkillBeheer > 0 || aantalVragen > 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          error:
            "Deze medewerker kan nog niet worden verwijderd omdat er historie aan de medewerker gekoppeld is.",
          blokkades: {
            toegevoegdeSkills: aantalSkillBeheer,
            vragen: aantalVragen,
          },
        },
        { status: 409 }
      );
    }

    const verwijderdResultaat = await client.query(
      `DELETE FROM medewerkers
       WHERE id = $1`,
      [medewerkerId]
    );

    if (verwijderdResultaat.rowCount !== 1) {
      throw new Error(
        "De medewerker kon niet definitief worden verwijderd"
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      verwijderd: {
        id: medewerkerId,
        naam: medewerker.naam,
        email: opgeslagenEmail,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");

    console.error(
      "Fout bij volledig verwijderen medewerker:",
      err
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Verwijderen mislukt; er zijn geen wijzigingen opgeslagen",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}