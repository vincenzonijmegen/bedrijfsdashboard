// ===========================
// File: src/app/api/shiftbase/medewerkerrooster/route.ts
// ===========================
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

if (process.env.NODE_ENV === "development") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

export async function GET(req: NextRequest) {
  const rawKey = process.env.SHIFTBASE_API_KEY;
  const apiKey = rawKey?.trim() || "";

  if (!apiKey) {
    return NextResponse.json(
      { error: "SHIFTBASE_API_KEY ontbreekt" },
      { status: 500 }
    );
  }

  /**
   * Let op:
   * Als jullie bestaande rooster-koppeling al een andere werkende ShiftBase-url gebruikt,
   * vervang dan alleen deze URL door die bestaande url.
   */
  const url = new URL("https://api.shiftbase.com/api/shifts");

  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `API ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const details = await res.text();

      return NextResponse.json(
        {
          error: "Fout bij ophalen rooster uit ShiftBase",
          details,
        },
        { status: res.status }
      );
    }

    const data = await res.json();

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Interne fout bij ophalen rooster",
        details: String(err),
      },
      { status: 500 }
    );
  }
}