// ===========================
// File: src/app/api/shiftbase/timesheets/route.ts
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

  const url = new URL(req.url);
  const min = url.searchParams.get("min_date") || "";
  const max = url.searchParams.get("max_date") || "";
  const userIds = url.searchParams.get("user_ids"); // optioneel CSV
  const debug = url.searchParams.get("debug") === "1";

  // Bouw query richting ShiftBase – GEEN filtering op status!
  const qs = new URLSearchParams();
  if (min) qs.set("min_date", min);
  if (max) qs.set("max_date", max);
  if (userIds) {
    userIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((id) => qs.append("user_id[]", id)); // ShiftBase accepteert arrays in deze vorm
  }

  // Deze extra params zijn defensief: als ShiftBase ze negeert is dat oké; als ze bestaan, zorgen ze dat
  // ook goedgekeurde (approved) regels meekomen.
  qs.set("include_approved", "1");
  qs.append("status[]", "approved");
  qs.append("status[]", "open");
  qs.append("status[]", "rejected");

  try {
    const resp = await fetch(`https://api.shiftbase.com/api/timesheets?${qs.toString()}`, {
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
      // laat text vallen als parse faalt
    }

    if (!resp.ok) {
      return NextResponse.json(
        { error: "Fout bij ophalen timesheets (ShiftBase)", details: json ?? text },
        { status: resp.status }
      );
    }

    const rows = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];

    if (!debug) {
      return NextResponse.json(
        { data: rows, meta: json?.meta ?? null },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Debug extra's (handig om te zien wat er terugkomt)
    const byStatus: Record<string, number> = {};
    let withIn = 0;
    let withOut = 0;
    for (const r of rows) {
      const t = r?.Timesheet ?? r;
      const st = t?.status ?? "unknown";
      byStatus[st] = (byStatus[st] || 0) + 1;
      if (t?.clocked_in) withIn++;
      if (t?.clocked_out) withOut++;
    }

    return NextResponse.json(
      {
        data: rows,
        meta: { ...(json?.meta ?? {}), count: rows.length, withIn, withOut, byStatus },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ error: "Interne fout", details: String(err) }, { status: 500 });
  }
}
