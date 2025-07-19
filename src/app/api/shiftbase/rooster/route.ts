// src/app/api/shiftbase/rooster/route.ts

import { NextResponse } from 'next/server';

export async function GET() {
  const url = 'https://api.shiftbase.com/api/rosters';

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'API-Key': process.env.SHIFTBASE_API_KEY ?? '',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Shiftbase API fout:', error);
      return NextResponse.json({ error: 'Fout bij ophalen van rooster' }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Technische fout:', err);
    return NextResponse.json({ error: 'Technische fout bij rooster-oproep' }, { status: 500 });
  }
}
