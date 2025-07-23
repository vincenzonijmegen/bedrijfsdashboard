// src/app/api/shiftbase/rooster/route.ts

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const apiKey = process.env.SHIFTBASE_API_KEY;
  // Base endpoint for fetching rosters
  const url = new URL("https://api.shiftbase.com/api/rosters");

  // Forward any query parameters (e.g., date or period) to Shiftbase
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  try {
    // Fetch roster data from Shiftbase
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `API ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const details = await res.text();
      return NextResponse.json(
        { error: "Shiftbase fout bij ophalen roosters", details },
        { status: res.status }
      );
    }

    const data = await res.json();
    // Return full roster payload; front-end will filter/display per date
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Interne serverfout in roster-route", details: String(err) },
      { status: 500 }
    );
  }
}
