export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { verifyJWT } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const TOEGESTANE_LEESROLLEN = ["beheerder", "accountant"];
const TOEGESTANE_SCHRIJFROLLEN = ["beheerder"];

async function haalRolUitSessie(req: NextRequest) {
  const gebruikerJWT = verifyJWT(req);

  const result = await db.query(
    `SELECT rol
     FROM medewerkers
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [gebruikerJWT.email]
  );

  const gebruiker = result.rows[0];

  if (!gebruiker) {
    return null;
  }

  return String(gebruiker.rol || "").toLowerCase();
}

async function magLezen(req: NextRequest) {
  try {
    const rol = await haalRolUitSessie(req);
    return !!rol && TOEGESTANE_LEESROLLEN.includes(rol);
  } catch {
    return false;
  }
}

async function magSchrijven(req: NextRequest) {
  try {
    const rol = await haalRolUitSessie(req);
    return !!rol && TOEGESTANE_SCHRIJFROLLEN.includes(rol);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const toegestaan = await magSchrijven(req);

    if (!toegestaan) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    const body = await req.json();

    const {
      naam,
      email,
      score,
      juist,
      totaal,
      instructie_id,
      tijdstip,
      functie,
    } = body;

    if (
      !naam ||
      !email ||
      score == null ||
      juist == null ||
      totaal == null ||
      !instructie_id
    ) {
      return NextResponse.json(
        { error: "Onvolledige resultaatgegevens." },
        { status: 400 }
      );
    }

    await db.query(
      `INSERT INTO toetsresultaten
        (naam, email, score, juist, totaal, instructie_id, tijdstip, functie)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email, instructie_id)
       DO UPDATE SET
         score = EXCLUDED.score,
         juist = EXCLUDED.juist,
         totaal = EXCLUDED.totaal,
         tijdstip = EXCLUDED.tijdstip,
         functie = EXCLUDED.functie`,
      [
        naam,
        email,
        Number(score),
        Number(juist),
        Number(totaal),
        instructie_id,
        tijdstip || new Date(),
        functie || null,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Fout bij opslaan resultaat:", err);

    return NextResponse.json(
      { error: "Opslaan resultaat mislukt." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const toegestaan = await magLezen(req);

    if (!toegestaan) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    const result = await db.query(
      `SELECT t.naam,
              t.email,
              t.score,
              t.juist,
              t.totaal,
              i.titel,
              t.tijdstip,
              t.functie,
              g.gelezen_duur_seconden AS duur_seconden
       FROM toetsresultaten t
       LEFT JOIN instructies i
         ON t.instructie_id = i.id
       LEFT JOIN gelezen_instructies g
         ON lower(g.email) = lower(t.email)
        AND g.instructie_id = t.instructie_id
       ORDER BY t.tijdstip DESC`
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("❌ Fout bij ophalen resultaten:", err);

    return NextResponse.json(
      { error: "Ophalen resultaten mislukt." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const toegestaan = await magSchrijven(req);

    if (!toegestaan) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    const email = req.nextUrl.searchParams.get("email");
    const titel = req.nextUrl.searchParams.get("titel");

    if (!email || !titel) {
      return NextResponse.json(
        { error: "email en titel zijn verplicht" },
        { status: 400 }
      );
    }

    await db.query(
      `DELETE FROM toetsresultaten
       WHERE lower(email) = lower($1)
         AND titel = $2`,
      [email, titel]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Fout bij verwijderen resultaat:", err);

    return NextResponse.json(
      { error: "Verwijderen resultaat mislukt." },
      { status: 500 }
    );
  }
}