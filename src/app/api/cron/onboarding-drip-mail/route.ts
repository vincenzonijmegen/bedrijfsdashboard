// src/app/api/cron/onboarding-drip-mail/route.ts

import { NextRequest, NextResponse } from "next/server";
import { verstuurOnboardingDrip } from "@/lib/onboarding/verstuurOnboardingDrip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const origin =
  process.env.APP_URL || "https://werkinstructies-app.vercel.app";

const resultaat = await verstuurOnboardingDrip({
  origin,
  limit: 5,
  bouwWachtrij: false,
});

    return NextResponse.json({
      success: true,
      bron: "cron-onboarding-drip-mail",
      resultaat,
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