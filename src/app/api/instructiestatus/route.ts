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

// POST: sla op dat een instructie is gelezen door een gebruiker
// Oude medewerkerflow is geparkeerd; alleen beheer mag dit nog handmatig doen.
export async function POST(req: NextRequest) {
  try {
    const toegestaan = await magSchrijven(req);

    if (!toegestaan) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    const { email, instructie_id } = await req.json();

    if (!email || !instructie_id) {
      return NextResponse.json(
        { error: "E-mail en instructie_id zijn verplicht." },
        { status: 400 }
      );
    }

    await db.query(
      `INSERT INTO gelezen_instructies (email, instructie_id)
       VALUES ($1, $2)
       ON CONFLICT (email, instructie_id) DO NOTHING`,
      [email, instructie_id]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Fout bij opslaan gelezen status:", err);

    return NextResponse.json(
      { error: "Opslaan gelezen status mislukt." },
      { status: 500 }
    );
  }
}

// GET: geef lijst van gelezen instructies met eventuele score voor een specifieke gebruiker
export async function GET(req: NextRequest) {
  try {
    const toegestaan = await magLezen(req);

    if (!toegestaan) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    const email = req.nextUrl.searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "E-mail is verplicht." },
        { status: 400 }
      );
    }

    const result = await db.query(
      `SELECT g.instructie_id,
              i.slug,
              i.titel,
              g.gelezen_op,
              r.score,
              r.juist,
              r.totaal
       FROM gelezen_instructies g
       JOIN instructies i ON g.instructie_id = i.id
       LEFT JOIN toetsresultaten r
         ON r.instructie_id = g.instructie_id
        AND lower(r.email) = lower(g.email)
       WHERE lower(g.email) = lower($1)
       ORDER BY g.gelezen_op DESC`,
      [email]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("❌ Fout bij ophalen gelezen instructies:", err);

    return NextResponse.json(
      { error: "Ophalen gelezen instructies mislukt." },
      { status: 500 }
    );
  }
}