// src/app/api/shiftbase/timesheets/route.ts

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const apiKey = process.env.SHIFTBASE_API_KEY;
  const url = new URL("https://api.shiftbase.com/api/timesheets");

  // Voeg query parameters toe aan de externe URL (bijv. min_date, max_date)
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  // Bepaal of historische (goedgekeurde) kloktijden meegegeven moeten worden
  const includeApproved = req.nextUrl.searchParams.get('includeApproved') === 'true';

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `API ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const msg = await res.text();
      return NextResponse.json({ error: "Shiftbase fout", details: msg }, { status: res.status });
    }

    const data = await res.json();

    // Filter op status: standaard alleen 'Pending'; met includeApproved=true ook 'Approved'
    const allowedStatuses = includeApproved ? ['Pending', 'Approved'] : ['Pending'];
    data.data = data.data.filter((t: any) => allowedStatuses.includes(t.Timesheet.status));

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "Interne fout", details: String(err) }, { status: 500 });
  }
}
