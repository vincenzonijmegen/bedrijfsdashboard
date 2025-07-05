// src/app/api/shiftbase/medewerkers/route.ts
import { NextRequest, NextResponse } from "next/server";

if (process.env.NODE_ENV === "development") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

export async function GET(req: NextRequest) {
  const rawKey = process.env.SHIFTBASE_API_KEY;
  const apiKey = rawKey?.trim();
  const authHeader = `API ${apiKey}`;

  try {
    const res = await fetch("https://api.shiftbase.com/api/users", {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const msg = await res.text();
      return NextResponse.json({ error: "Fout bij ophalen gebruikers", details: msg }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "Interne fout", details: String(err) }, { status: 500 });
  }
}
