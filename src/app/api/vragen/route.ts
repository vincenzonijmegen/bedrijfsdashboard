// 📄 Bestand: src/app/api/vragen/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyJWT } from "@/lib/auth";
import { Resend } from "resend";

// ✅ Helper: medewerker ophalen via JWT
async function getGebruikerMetId(req: NextRequest) {
  try {
    const payload = verifyJWT(req); // bevat email, naam, functie
    const { rows } = await db.query(
      "SELECT id, naam, email FROM medewerkers WHERE email = $1",
      [payload.email]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

// ✅ GET: eigen vragen ophalen
export async function GET(req: NextRequest) {
  const gebruiker = await getGebruikerMetId(req);
  if (!gebruiker) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { rows } = await db.query(
    `SELECT id, vraag, antwoord, aangemaakt_op
     FROM vragen
     WHERE medewerker_id = $1
     ORDER BY aangemaakt_op DESC`,
    [gebruiker.id]
  );

  return NextResponse.json(rows);
}

// ✅ POST: nieuwe vraag indienen
export async function POST(req: NextRequest) {
  try {
    const payload = verifyJWT(req);
    const { vraag } = await req.json();
    const naam = payload.naam || "(onbekend)";
    const email = payload.email;

    if (!vraag || typeof vraag !== "string") {
      return NextResponse.json({ error: "Ongeldige vraag" }, { status: 400 });
    }

    // Medewerker ID ophalen
    const { rows } = await db.query(
      "SELECT id FROM medewerkers WHERE email = $1",
      [email]
    );
    const medewerkerId = rows?.[0]?.id;
    if (!medewerkerId) {
      return NextResponse.json({ error: "Medewerker onbekend" }, { status: 403 });
    }

    // Invoegen in database
    await db.query(
      `INSERT INTO vragen (vraag, medewerker_id)
       VALUES ($1, $2)`,
      [vraag, medewerkerId]
    );

    // Mail versturen naar leiding
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
      to: "info@ijssalonvincenzo.nl",
      subject: `📩 Nieuwe vraag van ${naam}`,
      html: `
        <p>Er is een nieuwe vraag binnengekomen in het werkinstructieportaal.</p>
        <p><strong>Van:</strong> ${naam} (${email})</p>
        <p><strong>Vraag:</strong></p>
        <blockquote>${vraag}</blockquote>
        <p>Bekijk de vraag in het dashboard:</p>
        <p><a href="https://werkinstructies-app.vercel.app/admin/vragen">Open dashboard</a></p>
      `,
    });

    console.log("📧 Vraagmelding verzonden:", result);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Fout bij POST /vragen:", err);
    return NextResponse.json(
      { error: "Serverfout bij indienen vraag" },
      { status: 500 }
    );
  }
}
