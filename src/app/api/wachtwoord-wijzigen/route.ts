export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt, { type JwtPayload, type Secret } from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET_ENV = process.env.JWT_SECRET;

if (!JWT_SECRET_ENV) {
  throw new Error("JWT_SECRET ontbreekt in omgeving");
}

const JWT_SECRET: Secret = JWT_SECRET_ENV;
const TOEGESTANE_ROLLEN = ["beheerder", "accountant"];

type SessiePayload = JwtPayload & {
  email?: string;
  rol?: string;
};

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("sessie_token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Niet ingelogd." },
        { status: 401 }
      );
    }

    let payload: SessiePayload;

    try {
      payload = jwt.verify(token, JWT_SECRET) as SessiePayload;
    } catch {
      return NextResponse.json(
        { success: false, error: "Sessie is verlopen. Log opnieuw in." },
        { status: 401 }
      );
    }

    const email = payload.email;
    const rol = String(payload.rol || "").toLowerCase();

    if (!email || !TOEGESTANE_ROLLEN.includes(rol)) {
      return NextResponse.json(
        { success: false, error: "Geen toegang." },
        { status: 403 }
      );
    }

    const { nieuwWachtwoord } = await req.json();

    if (!nieuwWachtwoord) {
      return NextResponse.json(
        { success: false, error: "Nieuw wachtwoord is verplicht." },
        { status: 400 }
      );
    }

    if (String(nieuwWachtwoord).length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: "Kies een wachtwoord van minimaal 8 tekens.",
        },
        { status: 400 }
      );
    }

    const hashed = await bcrypt.hash(nieuwWachtwoord, 10);

    await db.query(
      `UPDATE medewerkers
       SET wachtwoord = $1,
           moet_wachtwoord_wijzigen = false
       WHERE lower(email) = lower($2)
         AND lower(rol) = ANY($3::text[])`,
      [hashed, email, TOEGESTANE_ROLLEN]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Fout bij wachtwoord wijzigen:", err);

    return NextResponse.json(
      { success: false, error: "Wijzigen mislukt" },
      { status: 500 }
    );
  }
}