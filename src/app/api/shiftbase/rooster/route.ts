// src/app/api/shiftbase/rooster/route.ts

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const apiKey = process.env.SHIFTBASE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'SHIFTBASE_API_KEY is niet ingesteld' },
      { status: 500 }
    );
  }

  const url = new URL("https://api.shiftbase.com/api/rosters");
  const { searchParams } = new URL(request.url);

  // Ondersteun 'datum' query als periodStart & periodEnd
  const datum = searchParams.get('datum');
  if (datum) {
    url.searchParams.set('periodStart', datum);
    url.searchParams.set('periodEnd', datum);
  } else {
    // Forward overige query parameters direct
    searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const details = await res.text();
      return NextResponse.json(
        { error: 'Shiftbase fout bij ophalen roosters', details },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: 'Interne serverfout in roster-route', details: String(err) },
      { status: 500 }
    );
  }
}
