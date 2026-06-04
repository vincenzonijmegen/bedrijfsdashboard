// src/app/api/admin/onboarding-drip/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  bouwOnboardingWachtrijBij,
  haalOnboardingDripStatus,
  verstuurOnboardingDrip,
} from "@/lib/onboarding/verstuurOnboardingDrip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const statussen = await haalOnboardingDripStatus();

    return NextResponse.json({
      success: true,
      statussen,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Onboarding drip-status kon niet worden opgehaald: ${String(
          error
        )}`,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const actie = String(body?.actie || "verstuur_volgende");

    if (actie === "bouw_wachtrij") {
      const wachtrij = await bouwOnboardingWachtrijBij();

      return NextResponse.json({
        success: true,
        actie,
        wachtrij,
      });
    }

    if (actie !== "verstuur_volgende") {
      return NextResponse.json(
        {
          success: false,
          error: "Onbekende actie.",
        },
        { status: 400 }
      );
    }

    const resultaat = await verstuurOnboardingDrip({
      origin: req.nextUrl.origin,
      limit: 5,
      bouwWachtrij: false,
    });

    return NextResponse.json({
      success: true,
      actie,
      ...resultaat,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Onboarding drip kon niet worden uitgevoerd: ${String(error)}`,
      },
      { status: 500 }
    );
  }
}