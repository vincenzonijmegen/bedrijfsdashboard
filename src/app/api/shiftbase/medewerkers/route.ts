import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const apiKey = process.env.SHIFTBASE_API_KEY;

  const url = "https://api.shiftbase.com/api/employees?include_inactive=false";

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `API ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const msg = await res.text();
      console.error("Shiftbase fout:", msg);
      return NextResponse.json({ error: "Shiftbase fout", details: msg }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Interne fout:", err);
    return NextResponse.json({ error: "Interne fout", details: String(err) }, { status: 500 });
  }
}
