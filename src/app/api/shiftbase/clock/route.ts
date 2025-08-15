// ===========================
// File: src/app/api/shiftbase/clock/route.ts
// Proxy voor ShiftBase: /api/timesheets/clock
// ===========================
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

if (process.env.NODE_ENV === "development") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

export async function GET(req: NextRequest) {
  const rawKey = process.env.SHIFTBASE_API_KEY;
  const apiKey = rawKey?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "SHIFTBASE_API_KEY ontbreekt" }, { status: 500 });
  }

  const authHeader = `API ${apiKey}`;

  // doorgeven van filters (optioneel)
  const inUrl = new URL(req.url);
  const min = inUrl.searchParams.get("min_date") || "";
  const max = inUrl.searchParams.get("max_date") || "";
  const date = inUrl.searchParams.get("date") || ""; // fallback
  const userIds = inUrl.searchParams.get("user_ids"); // CSV

  const qs = new URLSearchParams();
  if (min) qs.set("min_date", min);
  if (max) qs.set("max_date", max);
  if (date) qs.set("date", date);
  if (userIds) {
    userIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((id) => qs.append("user_id[]", id));
  }

  try {
    const url = `https://api.shiftbase.com/api/timesheets/clock${qs.toString() ? "?" + qs.toString() : ""}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const text = await resp.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // laat tekst door als JSON niet parsebaar is
    }

    if (!resp.ok) {
      return NextResponse.json(
        { error: "Fout bij ophalen timesheets/clock (ShiftBase)", details: json ?? text },
        { status: resp.status }
      );
    }

    // ShiftBase kan soms raw array geven of { data: [...] }
    const rows = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    return NextResponse.json({ data: rows, meta: json?.meta ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: "Interne fout", details: String(err) }, { status: 500 });
  }
}
