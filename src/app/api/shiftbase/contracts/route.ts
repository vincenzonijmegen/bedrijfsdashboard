import { NextResponse } from "next/server";

const SHIFTBASE_BASE = "https://api.shiftbase.com/api/contracts";

export const dynamic = "force-dynamic"; // geen caching van Vercel
export const revalidate = 0;

export async function GET(req: Request) {
  const apiKey = process.env.SHIFTBASE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "SHIFTBASE_API_KEY ontbreekt in environment." },
      { status: 500 }
    );
  }

  // Stuur queryparameters (indien gebruikt) door naar Shiftbase
  const { searchParams } = new URL(req.url);
  const url = new URL(SHIFTBASE_BASE);
  searchParams.forEach((v, k) => url.searchParams.set(k, v));

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: apiKey, // volgens jouw voorbeeldheader
      },
      // Belangrijk: geen cache op server
      cache: "no-store",
    });

    // Forward status + body (of nette fout)
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        {
          error: `Shiftbase responded ${res.status}`,
          body: safeJson(text),
        },
        { status: res.status }
      );
    }

    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Fetch naar Shiftbase mislukt", detail: String(err?.message ?? err) },
      { status: 502 }
    );
  }
}

// Probeert JSON te parsen, anders plain text teruggeven
function safeJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
