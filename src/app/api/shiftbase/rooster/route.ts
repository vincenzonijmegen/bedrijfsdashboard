// src/app/api/shiftbase/rooster/route.ts
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const datum = searchParams.get("datum");  // verwacht “YYYY-MM-DD”

  if (!datum) {
    return NextResponse.json(
      { error: "datum query-parameter is verplicht (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  const apiKey = process.env.SHIFTBASE_API_KEY;
  const url = new URL("https://api.shiftbase.com/api/rosters");
  url.searchParams.set("periodStart", datum);
  url.searchParams.set("periodEnd", datum);

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
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
