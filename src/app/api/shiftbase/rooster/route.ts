// src/app/api/shiftbase/rooster/route.ts

import { NextResponse } from 'next/server';

export async function GET() {
  const url = 'https://api.shiftbase.com/api/rosters';

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `API ${process.env.SHIFTBASE_API_KEY ?? ''}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Shiftbase API fout:', error);
      return NextResponse.json({ error: 'Fout bij ophalen van rooster' }, { status: 500 });
    }

    const data = await response.json();
    // Filter alleen diensten van vandaag
    const vandaag = new Date().toISOString().split("T")[0];
    const vandaagRosters = data.data.filter((item: any) => item.Roster.date === vandaag);

    return NextResponse.json({ data: vandaagRosters });
  } catch (err) {
    console.error('Technische fout:', err);
    return NextResponse.json({ error: 'Technische fout bij rooster-oproep' }, { status: 500 });
  }
}
