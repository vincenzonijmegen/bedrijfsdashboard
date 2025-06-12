// ✅ app/api/medewerkers/route.ts
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET() {
  const result = await sql`SELECT * FROM medewerkers ORDER BY naam`;
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { naam, email, functie } = body;

  if (!naam || !email || !functie) {
    return NextResponse.json({ error: "Informatie ontbreekt" }, { status: 400 });
  }

  const insert = await sql`
    INSERT INTO medewerkers (naam, email, functie)
    VALUES (${naam}, ${email}, ${functie})
    RETURNING *
  `;

  return NextResponse.json(insert.rows[0]);
}
