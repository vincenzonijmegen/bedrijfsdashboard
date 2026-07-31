// app/api/mail/bestelling/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyJWT } from "@/lib/auth";
import { sendBestellingMail } from "@/lib/mail";

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

async function magSchrijven(req: NextRequest) {
  try {
    const rol = await haalRolUitSessie(req);
    return !!rol && TOEGESTANE_SCHRIJFROLLEN.includes(rol);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const toegestaan = await magSchrijven(req);

  if (!toegestaan) {
    return NextResponse.json(
      { error: "Geen toegang" },
      { status: 403 }
    );
  }

  try {
    const { naar, onderwerp, tekst } = await req.json();

    if (!naar || !onderwerp || !tekst) {
      return NextResponse.json(
        { error: "Ontbrekende gegevens" },
        { status: 400 }
      );
    }

    await sendBestellingMail(
      Array.isArray(naar) ? naar.join(", ") : String(naar),
      String(onderwerp),
      String(tekst)
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Mailfout bij /api/mail/bestelling:", err);

    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}