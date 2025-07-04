import { NextRequest, NextResponse } from "next/server";

// Alleen lokaal gebruiken: SSL-verificatie uitschakelen
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";


export async function GET(req: NextRequest) {
  const apiKey = process.env.SHIFTBASE_API_KEY;
  const url = new URL("https://api.shiftbase.com/api/open_shifts");

  // optionele queryparams zoals ?min_date=2025-07-04
  const { searchParams } = req.nextUrl;
  for (const [key, value] of searchParams) {
    url.searchParams.set(key, value);
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const tekst = await res.text();
      console.error("Shiftbase API error:", tekst);
      return NextResponse.json({ error: "Fout bij ophalen open diensten", details: tekst }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Fout in open-diensten route:", err);
    return NextResponse.json({ error: "Serverfout", details: String(err) }, { status: 500 });
  }
}
