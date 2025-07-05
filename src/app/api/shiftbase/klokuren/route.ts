// src/app/api/shiftbase/klokuren/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const apiKey = process.env.SHIFTBASE_API_KEY;
  const url = new URL("https://api.shiftbase.com/api/timeclock_entries");

  // Kopieer queryparams uit frontend
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

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
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "Interne fout", details: String(err) }, { status: 500 });
  }
}
