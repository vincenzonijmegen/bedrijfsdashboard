// File: src/app/api/shiftbase/rooster/route.ts
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Haal datum parameter op (YYYY-MM-DD)
  const { searchParams } = new URL(request.url);
  const datum = searchParams.get('datum');
  if (!datum) {
    return NextResponse.json(
      { error: 'Query parameter `datum` is verplicht (YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  // Controleer API-key
  const apiKey = process.env.SHIFTBASE_API_KEY;
  if (!apiKey) {
    console.error('SHIFTBASE_API_KEY ontbreekt!');
    return NextResponse.json(
      { error: 'SHIFTBASE_API_KEY is niet ingesteld op de server' },
      { status: 500 }
    );
  }

  // Bouw Shiftbase-URL
  const url = new URL('https://api.shiftbase.com/api/rosters');
  url.searchParams.set('periodStart', datum);
  url.searchParams.set('periodEnd', datum);

  try {
    // Fetch vanaf server (server-side env-vars zijn beschikbaar)
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    // Als niet OK, stuur fout door
    if (!res.ok) {
      const details = await res.text();
      console.error('Shiftbase API-fout:', res.status, details);
      return NextResponse.json(
        { error: 'Shiftbase fout bij ophalen roosters', details },
        { status: res.status }
      );
    }

    // JSON-parsen en teruggeven
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Interne fout in shiftbase/rooster:', err);
    return NextResponse.json(
      { error: 'Interne serverfout in rooster-route', details: String(err) },
      { status: 500 }
    );
  }
}
