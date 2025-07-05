import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const email = req.cookies.get("email")?.value;

  if (!email) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  try {
    const result = await db.query(
      `SELECT naam, email FROM medewerkers WHERE email = $1`,
      [email]
    );

    const gebruiker = result.rows[0];
    if (!gebruiker) {
      return NextResponse.json({ error: "Gebruiker niet gevonden" }, { status: 404 });
    }

    return NextResponse.json(gebruiker);
  } catch (err) {
    console.error("Fout in /api/user:", err);
    return NextResponse.json({ error: "Interne fout" }, { status: 500 });
  }
}
