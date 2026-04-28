// src/app/api/test/weekrapport-mail/route.ts

import { NextRequest, NextResponse } from "next/server";
import { renderWeekrapportEmail } from "@/lib/mail/renderWeekrapportEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin;

    const res = await fetch(`${origin}/api/rapportage/weekrapport`, {
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok || !data?.success) {
      return NextResponse.json(
        { error: "Fout bij ophalen weekrapport", details: data?.error },
        { status: 500 }
      );
    }

    const { html } = renderWeekrapportEmail(data);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Fout bij test weekrapport", details: String(err) },
      { status: 500 }
    );
  }
}