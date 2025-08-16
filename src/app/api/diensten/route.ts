import { NextResponse } from "next/server";

// Helper: vandaag in Europe/Amsterdam als YYYY-MM-DD
function todayAmsterdam(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || todayAmsterdam(); // fallback naar vandaag
  const rol = url.searchParams.get("rol") ?? "balie";

  const BASE = process.env.REKENSERVICE_URL;
  const TOKEN = process.env.API_REKEN_TOKEN;

  if (!BASE || !TOKEN) {
    return NextResponse.json(
      { ok: false, error: "Missing REKENSERVICE_URL or API_REKEN_TOKEN in env" },
      { status: 500 }
    );
  }

  const upstream = await fetch(
    `${BASE}/diensten/day?date=${encodeURIComponent(date)}&rol=${encodeURIComponent(rol)}`,
    { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" }
  );

  // Als upstream geen JSON geeft, opvangen:
  let data: any;
  try {
    data = await upstream.json();
  } catch {
    data = { ok: false, error: `Upstream ${upstream.status} (geen JSON)` };
  }

  return NextResponse.json(data, { status: upstream.status });
}
