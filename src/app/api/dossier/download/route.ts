// src/app/api/dossier/download/route.ts

import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "Email ontbreekt" }, { status: 400 });
  }

  const result = await db.query(
    `SELECT sollicitatie_pdf FROM medewerkers WHERE email = $1`,
    [email]
  );

  const url = result.rows[0]?.sollicitatie_pdf;
  if (!url) {
    return NextResponse.json({ error: "Geen sollicitatiebestand gevonden" }, { status: 404 });
  }

 const res = await fetch(url);
if (!res.ok) {
  return NextResponse.json({ error: "Bestand niet gevonden in opslag" }, { status: 404 });
}

const blob = await res.blob();

return new Response(blob, {
  headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename=sollicitatie.pdf`
  }
});
}
