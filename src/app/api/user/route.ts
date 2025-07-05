// src/app/api/user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getIngelogdeGebruiker } from "@/lib/auth"; // pas aan aan jouw setup

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await getIngelogdeGebruiker(req); // bijvoorbeeld via cookie/token

    if (!gebruiker || !gebruiker.email) {
      return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
    }

    return NextResponse.json({
      naam: gebruiker.naam,
      email: gebruiker.email,
    });
  } catch (err) {
    console.error("Fout in /api/user:", err);
    return NextResponse.json({ error: "Interne fout" }, { status: 500 });
  }
}
