// src/app/api/admin/briefing/email-preview/route.ts

import { NextRequest, NextResponse } from "next/server";
import { renderBriefingEmail } from "@/lib/briefing/renderBriefingEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const datum = req.nextUrl.searchParams.get("datum");

  const briefingUrl = new URL("/api/admin/briefing", req.nextUrl.origin);

  if (datum) {
    briefingUrl.searchParams.set("datum", datum);
  }

  const briefingRes = await fetch(briefingUrl.toString(), {
    cache: "no-store",
  });

  if (!briefingRes.ok) {
    return NextResponse.json(
      {
        success: false,
        error: `Briefing kon niet worden opgehaald. Status: ${briefingRes.status}`,
      },
      { status: 500 }
    );
  }

  const briefingData = await briefingRes.json();
  const email = renderBriefingEmail(briefingData);

  return new NextResponse(email.html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}