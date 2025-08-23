import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// JWT-secret ophalen
const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new Error("JWT_SECRET ontbreekt in omgeving");

export async function POST(req: Request) {
  try {
    const { email, wachtwoord } = await req.json();

    // Medewerker ophalen
    const result = await db.query(
      `SELECT naam, email, wachtwoord, functie, rol, moet_wachtwoord_wijzigen FROM medewerkers WHERE lower(email) = lower($1) LIMIT 1`,
      [email]
    );

    const medewerker = result.rows[0];
    if (!medewerker) return fout("Ongeldige inloggegevens");

    // Wachtwoord check
    const wachtwoordCorrect = await bcrypt.compare(wachtwoord, medewerker.wachtwoord);
    if (!wachtwoordCorrect) return fout("Ongeldige inloggegevens");

    // JWT maken
    const token = jwt.sign(
      {
        email: medewerker.email,
        naam: medewerker.naam,
        functie: medewerker.functie,
        rol: medewerker.rol,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Response bouwen
    const response = new NextResponse(
      JSON.stringify({
        success: true,
        naam: medewerker.naam,
        functie: medewerker.functie,
        rol: medewerker.rol,
        email: medewerker.email,
        moetWachtwoordWijzigen: medewerker.moet_wachtwoord_wijzigen,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );

    // Cookie zetten
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
  return new NextResponse(
    JSON.stringify({ success: false, error: boodschap }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}
