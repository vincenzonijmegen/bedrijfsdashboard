// src/app/api/cron/dagbriefing-mail/route.ts

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const mailUrl = new URL("/api/admin/briefing/mail", req.nextUrl.origin);

    const res = await fetch(mailUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });

    const json = await res.json();

    return NextResponse.json(
      {
        success: res.ok && Boolean(json?.success),
        bron: "cron-dagbriefing-mail",
        resultaat: json,
      },
      { status: res.ok ? 200 : 500 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        bron: "cron-dagbriefing-mail",
        error: `Cron dagbriefing kon niet worden uitgevoerd: ${String(error)}`,
      },
      { status: 500 }
    );
  }
}