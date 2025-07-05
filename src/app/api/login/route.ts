import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers"; // ← toegevoegde import
import bcrypt from "bcryptjs";

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

    // ⬇️ Zet cookies
const cookieStore = await cookies();
cookieStore.set("email", medewerker.email, {
  httpOnly: false,
  sameSite: "lax",
  path: "/",
});
cookieStore.set("naam", medewerker.naam, {
  httpOnly: false,
  sameSite: "lax",
  path: "/",
});

    return NextResponse.json({
      success: true,
      naam: medewerker.naam,
      functie: medewerker.functie,
      email: medewerker.email,
      moetWachtwoordWijzigen: medewerker.moet_wachtwoord_wijzigen,
    });
  } catch (err) {
    console.error("Fout bij inloggen:", err);
    return NextResponse.json({ success: false, error: "Serverfout" }, { status: 500 });
  }
}
