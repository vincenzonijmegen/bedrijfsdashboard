// ===========================
// File: src/app/api/shiftbase/rooster/route.ts
// ===========================
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Haal datum op
  const { searchParams } = new URL(request.url);
  const datum = searchParams.get('datum');
  if (!datum) {
    return NextResponse.json(
      { error: 'Query parameter `datum` is verplicht (YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  // API key
  const apiKey = process.env.SHIFTBASE_API_KEY;
  if (!apiKey) {
    console.error('SHIFTBASE_API_KEY niet ingesteld');
    return NextResponse.json(
      { error: 'SHIFTBASE_API_KEY ontbreekt' },
      { status: 500 }
    );
  }

  // Bouw URL
  const url = new URL('https://api.shiftbase.com/api/rosters');
url.searchParams.set('periodStart', `${datum}T00:00:00`);
url.searchParams.set('periodEnd', `${datum}T23:59:59`);

  // Fetch
  const res = await fetch(url.toString(), {
    headers: { Authorization: `API ${apiKey}` },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) {
    console.error('Shiftbase error:', res.status, text);
    return NextResponse.json(
      { error: 'Shiftbase fout', details: text },
      { status: res.status }
    );
  }
  // Parse JSON
  let data;
  try {
    const json = JSON.parse(text);
    data = Array.isArray(json) ? json : json.data;
  } catch {
    console.error('JSON parse fout:', text);
    return NextResponse.json(
      { error: 'Ongeldige JSON in response' },
      { status: 502 }
    );
  }
  return NextResponse.json(data);
}