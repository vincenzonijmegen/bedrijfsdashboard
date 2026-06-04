// src/app/api/cron/onboarding-wachtrij-bijwerken/route.ts

import { NextResponse } from "next/server";
import { bouwOnboardingWachtrijBij } from "@/lib/onboarding/verstuurOnboardingDrip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const wachtrij = await bouwOnboardingWachtrijBij();

    return NextResponse.json({
      success: true,
      bron: "cron-onboarding-wachtrij-bijwerken",
      wachtrij,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        bron: "cron-onboarding-wachtrij-bijwerken",
        error: `Onboarding wachtrij bijwerken mislukt: ${String(error)}`,
      },
      { status: 500 }
    );
  }
}