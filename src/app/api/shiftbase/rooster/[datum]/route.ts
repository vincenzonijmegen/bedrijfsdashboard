// src/app/api/shiftbase/rooster/[datum]/route.ts

import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { datum: string } }
) {
  const { datum } = params; // bijvoorbeeld "2025-07-22"
  const apiKey = process.env.SHIFTBASE_API_KEY;
  const url = new URL("https://api.shiftbase.com/api/rosters");

  // Zet expliciet de gewenste datum als parameter (Shiftbase verwacht meestal periodStart/periodEnd)
  url.searchParams.set("periodStart", datum);
  url.searchParams.set("periodEnd", datum);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Interne serverfout in rooster-route", details: String(err) },
      { status: 500 }
    );
  }
}
