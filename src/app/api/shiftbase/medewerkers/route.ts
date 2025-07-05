// src/app/api/shiftbase/medewerkers/route.ts
import { NextRequest, NextResponse } from "next/server";

// Alleen lokaal tijdens dev: SSL-check uitzetten
if (process.env.NODE_ENV === "development") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

export async function GET(req: NextRequest) {
  const rawKey = process.env.SHIFTBASE_API_KEY;
  const apiKey = rawKey?.trim() || "";
  const authHeader = `API ${apiKey}`;

  const url = new URL("https://api.shiftbase.com/api/employees?include_inactive=false");
  console.log("🌐 Requesting URL:", url.toString());

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const details = await res.text();
      console.error("Shiftbase API error:", details);
      return NextResponse.json(
        { error: "Fout bij ophalen medewerkers", details },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Fout in medewerkers route:", err);
    return NextResponse.json(
      { error: "Serverfout", details: String(err) },
      { status: 500 }
    );
  }
}
