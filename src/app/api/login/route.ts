import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// JWT-secret ophalen (en crashen als die ontbreekt)
const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new Error("JWT_SECRET ontbreekt in omgeving");

export async function POST(req: Request) {
  try {
    const { email, wachtwoord } = await req.json();

    // Stap 1: Medewerker ophalen
    const result = await db.query(
      `SELECT naam, email, wachtwoord, functie, moet_wachtwoord_wijzigen FROM medewerkers WHERE email = $1`,
      [email]
    );

    const medewerker = result.rows[0];
    if (!medewerker) {
      return fout("Ongeldige inloggegevens");
    }

    // Stap 2: Wachtwoord controleren
    const wachtwoordCorrect = await bcrypt.compare(wachtwoord, medewerker.wachtwoord);
    if (!wachtwoordCorrect) {
      return fout("Ongeldige inloggegevens");
    }

    // Stap 3: JWT aanmaken
    const token = jwt.sign(
  {
    email: medewerker.email,
    naam: medewerker.naam,
    functie: medewerker.functie,
    rol: medewerker.rol, // <-- toevoegen!
  },
  JWT_SECRET,
  { expiresIn: "7d" }
);

const res = NextResponse.json({
  success: true,
  naam: medewerker.naam,
  functie: medewerker.functie,
  rol: medewerker.rol,        // <-- deze toevoegen!
  email: medewerker.email,
  moetWachtwoordWijzigen: medewerker.moet_wachtwoord_wijzigen,
});



    res.cookies.set("sessie_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 dagen
    });

    return res;
  } catch (err) {
    console.error("Fout bij inloggen:", err);
    return fout("Serverfout", 500);
  }
}

// 🔧 Herbruikbare foutfunctie
function fout(boodschap: string, status = 401) {
  return NextResponse.json({ success: false, error: boodschap }, { status });
}
