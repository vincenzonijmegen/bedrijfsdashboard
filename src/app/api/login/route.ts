import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
  const { email, wachtwoord } = await req.json();

  try {
    const result = await db.query(`SELECT * FROM medewerkers WHERE email = $1`, [email]);

    if (result.rowCount !== 1) {
      return NextResponse.json({ success: false, error: "Ongeldige inloggegevens" }, { status: 401 });
    }

    const medewerker = result.rows[0];
    const wachtwoordCorrect = await bcrypt.compare(wachtwoord, medewerker.wachtwoord);

    if (!wachtwoordCorrect) {
      return NextResponse.json({ success: false, error: "Ongeldige inloggegevens" }, { status: 401 });
    }

    // ✅ JWT aanmaken
    const token = jwt.sign(
      {
        email: medewerker.email,
        naam: medewerker.naam,
        functie: medewerker.functie,
      },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" } // sessie blijft 7 dagen geldig
    );

    // ✅ JWT opslaan in HttpOnly-cookie
    const res = NextResponse.json({
      success: true,
      naam: medewerker.naam,
      functie: medewerker.functie,
      email: medewerker.email,
      moetWachtwoordWijzigen: medewerker.moet_wachtwoord_wijzigen,
    });

    res.cookies.set("sessie_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (err) {
    console.error("Fout bij inloggen:", err);
    return NextResponse.json({ success: false, error: "Serverfout" }, { status: 500 });
  }
}
