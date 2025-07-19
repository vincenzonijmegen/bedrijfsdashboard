// src/app/api/shiftbase/rooster/route.ts

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // Haal datum op uit query of standaard vandaag
    const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];
    console.log(`Gevraagde datum in API: ${dateParam}`);

    // Vraag Shiftbase API aan met from/to parameters om specifieke dag op te halen
    const url = `https://api.shiftbase.com/api/rosters?from=${dateParam}&to=${dateParam}`;
    console.log(`Shiftbase API URL: ${url}`);

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

    const result = await response.json();
    const rosters = result.data || [];
    console.log(`Aantal diensten ontvangen voor ${dateParam}: ${rosters.length}`);

    return NextResponse.json({ data: rosters });
  } catch (err) {
    console.error('Technische fout bij rooster-oproep:', err);
    return NextResponse.json({ error: 'Technische fout bij rooster-oproep' }, { status: 500 });
  }
}
