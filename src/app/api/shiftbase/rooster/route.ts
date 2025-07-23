import { NextResponse } from "next/server";

// src/app/api/shiftbase/rooster/route.ts
export async function GET(request: Request) {
  // Haal server-side API-key op
  const apiKey = process.env.SHIFTBASE_API_KEY;
  if (!apiKey) {
    console.error("SHIFTBASE_API_KEY ontbreekt in env-vars!");
    return NextResponse.json(
      { error: 'SHIFTBASE_API_KEY is niet ingesteld' },
      { status: 500 }
    );
  }

  // Lees query-param 'datum' (YYYY-MM-DD)
  const { searchParams } = new URL(request.url);
  const datum = searchParams.get('datum');
  if (!datum) {
    return NextResponse.json(
      { error: 'Query parameter `datum` is verplicht (YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  // Bouw Shiftbase API URL met geselecteerde datum
  const url = new URL('https://api.shiftbase.com/api/rosters');
  url.searchParams.set('periodStart', datum);
  url.searchParams.set('periodEnd', datum);

  try {
    // Server-side fetch met de Bearer header
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const details = await res.text();
      console.error('Shiftbase API error:', res.status, details);
      return NextResponse.json(
        { error: 'Shiftbase fout bij ophalen roosters', details },
        { status: res.status }
      );
    }

    const data = await res.json();
    // Data is een array van shifts
    return NextResponse.json(data);
  } catch (err) {
    console.error('Interne serverfout in rooster-route:', err);
    return NextResponse.json(
      { error: 'Interne serverfout', details: String(err) },
      { status: 500 }
    );
  }
}
