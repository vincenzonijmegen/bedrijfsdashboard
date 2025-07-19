// src/app/api/shiftbase/rooster/route.ts

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const url = 'https://api.shiftbase.com/api/rosters';
    console.log(`Proxy Shiftbase rosters API: ${url}`);

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
    // Direct doorsturen van alle rosters
    return NextResponse.json({ data: result.data });
  } catch (err) {
    console.error('Technische fout bij rooster-oproep:', err);
    return NextResponse.json({ error: 'Technische fout bij rooster-oproep' }, { status: 500 });
  }
}
