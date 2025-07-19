// src/app/api/shiftbase/rooster/route.ts

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Haal datum op uit query of standaard vandaag
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];
  console.log(`Gevraagde datum in API: ${dateParam}`);

  // Shiftbase ondersteunt de ?date= niet betrouwbaar, dus haal alle rosters op
  // Gebruik from/to parameters om specifiek die dag op te halen
  const url = `https://api.shiftbase.com/api/rosters?from=${dateParam}&to=${dateParam}`;
  console.log(`Shiftbase API URL: ${url}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `API ${process.env.SHIFTBASE_API_KEY ?? ''}`,
      },
    });
    console.log(`Shiftbase response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shiftbase API fout:', errorText);
      return NextResponse.json({ error: 'Fout bij ophalen van rooster' }, { status: 500 });
    }

    const data = await response.json();
    console.log(`Aantal diensten ontvangen: ${data.data.length}`);

    // Lokaal filteren op gekozen datum
    const filtered = data.data.filter((item: any) => item.Roster.date === dateParam);
    console.log(`Aantal gefilterde diensten voor ${dateParam}: ${filtered.length}`);

    // Sorteer op starttijd
    filtered.sort((a: any, b: any) => a.Roster.starttime.localeCompare(b.Roster.starttime));

    return NextResponse.json({ data: filtered });
  } catch (err) {
    console.error('Technische fout bij rooster-oproep:', err);
    return NextResponse.json({ error: 'Technische fout bij rooster-oproep' }, { status: 500 });
  }
}
