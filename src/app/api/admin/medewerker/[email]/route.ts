import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { email: string } }) {
  const email = decodeURIComponent(params.email);

  try {
    const { rows } = await db.query(
      `SELECT email, naam, functie FROM medewerkers WHERE email = $1`,
      [email]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Medewerker niet gevonden" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (err: any) {
    console.error("Fout bij ophalen medewerker:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
