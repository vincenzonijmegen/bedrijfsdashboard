// app/api/diensten/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const rol = url.searchParams.get("rol") ?? "balie";

  if (!date) {
    return NextResponse.json({ ok: false, error: "Missing ?date=YYYY-MM-DD" }, { status: 400 });
  }

  const BASE = process.env.REKENSERVICE_URL;
  const TOKEN = process.env.API_REKEN_TOKEN;

  if (!BASE || !TOKEN) {
    return NextResponse.json(
      { ok: false, error: "Missing REKENSERVICE_URL or API_REKEN_TOKEN in env" },
      { status: 500 }
    );
  }

  const upstream = await fetch(`${BASE}/diensten/day?date=${encodeURIComponent(date)}&rol=${encodeURIComponent(rol)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
