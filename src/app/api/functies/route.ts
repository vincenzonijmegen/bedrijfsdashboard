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
