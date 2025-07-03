// src/app/api/functies/route.ts

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const result = await pool.query("SELECT * FROM functies ORDER BY naam");
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, naam, omschrijving } = body;

  if (!naam) {
    return NextResponse.json({ error: "Naam is verplicht" }, { status: 400 });
  }

  if (id) {
    await pool.query(
      "UPDATE functies SET naam = $1, omschrijving = $2 WHERE id = $3",
      [naam, omschrijving ?? null, id]
    );
  } else {
    await pool.query(
      "INSERT INTO functies (naam, omschrijving) VALUES ($1, $2)",
      [naam, omschrijving ?? null]
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Geen id meegegeven" }, { status: 400 });
  }

  const gebruikt = await pool.query(
    `SELECT 1 FROM medewerkers WHERE functie_id = $1
     UNION
     SELECT 1 FROM instructies WHERE functie_id = $1
     LIMIT 1`,
    [id]
  );

  if ((gebruikt?.rowCount ?? 0) > 0) {
    return NextResponse.json({ error: "Functie is nog in gebruik en kan niet worden verwijderd." }, { status: 400 });
  }

  await pool.query("DELETE FROM functies WHERE id = $1", [id]);
  return NextResponse.json({ success: true });
}
