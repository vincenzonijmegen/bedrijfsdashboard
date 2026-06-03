// src/app/api/cron/onboarding-drip-mail/route.ts

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL("/api/admin/onboarding-drip", req.nextUrl.origin);

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actie: "verstuur_volgende",
      }),
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok || !data?.success) {
      return NextResponse.json(
        {
          success: false,
          bron: "cron-onboarding-drip-mail",
          error: "Onboarding drip kon niet worden uitgevoerd.",
          status: res.status,
          details: data,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      bron: "cron-onboarding-drip-mail",
      resultaat: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        bron: "cron-onboarding-drip-mail",
        error: `Cron onboarding drip kon niet worden uitgevoerd: ${String(
          error
        )}`,
      },
      { status: 500 }
    );
  }
}