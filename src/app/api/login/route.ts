import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";

const JWT_SECRET_ENV = process.env.JWT_SECRET;

if (!JWT_SECRET_ENV) {
  throw new Error("JWT_SECRET ontbreekt in omgeving");
}

const JWT_SECRET: Secret = JWT_SECRET_ENV;
const TOEGESTANE_ROLLEN = ["beheerder", "accountant"];

export async function POST(req: Request) {
  try {
    const { email, wachtwoord } = await req.json();

    if (!email || !wachtwoord) {
      return fout("Ongeldige inloggegevens");
    }

    const result = await db.query(
      `SELECT naam,
              email,
              wachtwoord,
              functie,
              rol,
              moet_wachtwoord_wijzigen
       FROM medewerkers
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [email]
    );

    const medewerker = result.rows[0];

    if (!medewerker) {
      return fout("Ongeldige inloggegevens");
    }

    const wachtwoordCorrect = await bcrypt.compare(
      wachtwoord,
      medewerker.wachtwoord
    );

    if (!wachtwoordCorrect) {
      return fout("Ongeldige inloggegevens");
    }

    const rol = String(medewerker.rol || "").toLowerCase();

    if (!TOEGESTANE_ROLLEN.includes(rol)) {
      return fout(
        "Deze login is alleen voor beheer. Medewerkers ontvangen werkinstructies per mail."
      );
    }

      const signOptions: SignOptions = {
        expiresIn: "7d",
      };

      const token = jwt.sign(
        {
          email: medewerker.email,
          naam: medewerker.naam,
          functie: medewerker.functie,
          rol,
        },
        JWT_SECRET,
        signOptions
      );

    const response = NextResponse.json({
      success: true,
      naam: medewerker.naam,
      functie: medewerker.functie,
      rol,
      email: medewerker.email,
      moetWachtwoordWijzigen: medewerker.moet_wachtwoord_wijzigen,
    });

    response.cookies.set("sessie_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err) {
    console.error("Fout bij inloggen:", err);
    return fout("Serverfout", 500);
  }
}

function fout(boodschap: string, status = 401) {
  return NextResponse.json(
    {
      success: false,
      error: boodschap,
    },
    { status }
  );
}