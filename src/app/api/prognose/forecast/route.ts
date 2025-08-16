import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const res = await fetch(`${process.env.REKENSERVICE_URL}/forecast/day`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.API_REKEN_TOKEN}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: 502 });
  }
  return NextResponse.json(await res.json());
}
