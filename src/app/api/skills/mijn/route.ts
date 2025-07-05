// /api/skills/mijn

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const apiKey = process.env.SHIFTBASE_API_KEY;
  const url = new URL("https://api.shiftbase.com/api/userskills");

  // Huidige gebruiker ophalen via header (bijv. x-user-id)
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ skills: [], warning: "Geen gebruiker meegegeven" }, { status: 200 });
  }

  url.searchParams.set("user_id", userId);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `API ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const msg = await res.text();
      return NextResponse.json({ skills: [], warning: "Shiftbase fout", details: msg }, { status: 200 });
    }

    const data = await res.json();
    return NextResponse.json({ skills: data.data || [] });
  } catch (err) {
    return NextResponse.json({ skills: [], warning: "Interne fout", details: String(err) }, { status: 200 });
  }
}
