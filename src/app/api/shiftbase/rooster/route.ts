// src/app/api/shiftbase/rooster/route.ts

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Haal datum op uit query, standaard vandaag
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];

  const url = `https://api.shiftbase.com/api/rosters?date=${dateParam}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `API ${process.env.SHIFTBASE_API_KEY ?? ''}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shiftbase API fout:', errorText);
      return NextResponse.json({ error: 'Fout bij ophalen van rooster' }, { status: 500 });
    }

    const data = await response.json();
    // Filter op gekozen datum
    const filtered = data.data.filter((item: any) => item.Roster.date === dateParam);
    // Sorteer op starttijd
    filtered.sort((a: any, b: any) => a.Roster.starttime.localeCompare(b.Roster.starttime));

    return NextResponse.json({ data: filtered });
  } catch (err) {
    console.error('Technische fout bij rooster-oproep:', err);
    return NextResponse.json({ error: 'Technische fout bij rooster-oproep' }, { status: 500 });
  }
}
