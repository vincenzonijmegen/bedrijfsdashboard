import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("sessie_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { email: string };

    const result = await db.query(
      `SELECT naam, email FROM medewerkers WHERE email = $1`,
      [payload.email]
    );

    const gebruiker = result.rows[0];
    if (!gebruiker) {
      return NextResponse.json({ error: "Gebruiker niet gevonden" }, { status: 404 });
    }

    return NextResponse.json(gebruiker);
  } catch (err) {
    return NextResponse.json({ error: "Ongeldige sessie" }, { status: 401 });
  }
}
