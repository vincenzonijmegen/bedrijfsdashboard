// src/app/api/shiftbase/rooster/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const apiKey = process.env.SHIFTBASE_API_KEY;
  if (!apiKey) {
    console.error("SHIFTBASE_API_KEY ontbreekt!");
    return NextResponse.json(
      { error: "SHIFTBASE_API_KEY is niet ingesteld" },
      { status: 500 }
    );
  }

  // Bouw de juiste Shiftbase URL
  const url = new URL("https://api.shiftbase.com/api/rosters");
  const date = req.nextUrl.searchParams.get("date");
  if (date) {
    // Zet zowel periodStart als periodEnd op de gekozen datum
    url.searchParams.set("periodStart", date);
    url.searchParams.set("periodEnd", date);
  }

  // Dé correcte header‐prefix is 'Bearer', niet 'API'
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
  return NextResponse.json(data);
}
