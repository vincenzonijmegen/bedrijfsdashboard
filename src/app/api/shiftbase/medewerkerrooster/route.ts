// ===========================
// File: src/app/api/shiftbase/medewerkerrooster/route.ts
// ===========================
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const minDate = searchParams.get("min_date");
  const maxDate = searchParams.get("max_date");

  if (!minDate || !maxDate) {
    return NextResponse.json(
      { error: "Query parameters `min_date` en `max_date` zijn verplicht" },
      { status: 400 }
    );
  }

  const apiKey = process.env.SHIFTBASE_API_KEY;

  if (!apiKey) {
    console.error("SHIFTBASE_API_KEY niet ingesteld");

    return NextResponse.json(
      { error: "SHIFTBASE_API_KEY ontbreekt" },
      { status: 500 }
    );
  }

  const url = new URL("https://api.shiftbase.com/api/rosters");
  url.searchParams.set("min_date", minDate);
  url.searchParams.set("max_date", maxDate);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `API ${apiKey}`,
    },
    cache: "no-store",
  });

  const text = await res.text();

  if (!res.ok) {
    console.error("Shiftbase error:", res.status, text);

    return NextResponse.json(
      { error: "Shiftbase fout", details: text },
      { status: res.status }
    );
  }

  try {
    const json = JSON.parse(text);
    const data = Array.isArray(json) ? json : json.data;

    return NextResponse.json({
      data: Array.isArray(data) ? data : [],
    });
  } catch {
    console.error("JSON parse fout:", text);

    return NextResponse.json(
      { error: "Ongeldige JSON in response" },
      { status: 502 }
    );
  }
}