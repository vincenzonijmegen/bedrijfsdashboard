// src/app/api/shiftbase/open-diensten/route.ts
import { NextRequest, NextResponse } from "next/server";

// Alleen lokaal tijdens dev: SSL-check uitzetten
if (process.env.NODE_ENV === "development") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

export async function GET(req: NextRequest) {
  // 1) Haal en trim je key
  const rawKey = process.env.SHIFTBASE_API_KEY;
  const apiKey = rawKey?.trim() || "";
  console.log("🔑 RAW key:", JSON.stringify(rawKey));
  console.log("🔑 TRIMMED key:", JSON.stringify(apiKey));

  // 2) Bouw je auth-header
  const authHeader = `API ${apiKey}`;
  console.log("🔐 Authorization header:", authHeader);

  // 3) Definieer de URL wél (was nog weggevallen)
  const url = new URL("https://api.shiftbase.com/api/open_shifts");
  // (optioneel) query-parameters meegeven
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  console.log("🌐 Requesting URL:", url.toString());

  try {
    // 4) Doe de fetch
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
        { error: "Fout bij ophalen open diensten", details },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Fout in open-diensten route:", err);
    return NextResponse.json(
      { error: "Serverfout", details: String(err) },
      { status: 500 }
    );
  }
}
