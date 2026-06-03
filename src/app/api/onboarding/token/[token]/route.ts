// src/app/api/onboarding/token/[token]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{
    token: string;
  }>;
};

async function haalOpdracht(token: string) {
  const result = await db.query(
    `
    SELECT
      o.id,
      o.medewerker_email,
      o.instructie_id,
      o.status,
      o.token,
      o.token_verloopt_op,
      o.verzonden_op,
      o.afgerond_op,
      m.naam AS medewerker_naam,
      i.titel,
      i.nummer,
      i.slug,
      i.inhoud
    FROM onboarding_opdrachten o
    JOIN medewerkers m
      ON LOWER(m.email) = LOWER(o.medewerker_email)
    JOIN instructies i
      ON i.id = o.instructie_id
    WHERE o.token::text = $1
    LIMIT 1
    `,
    [token]
  );

  return result.rows[0] || null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    const opdracht = await haalOpdracht(token);

    if (!opdracht) {
      return NextResponse.json(
        {
          success: false,
          error: "Onboardinglink niet gevonden.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      opdracht,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Onboardinglink kon niet worden opgehaald: ${String(error)}`,
      },
      { status: 500 }
    );
  }
}

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    const opdracht = await haalOpdracht(token);

    if (!opdracht) {
      return NextResponse.json(
        {
          success: false,
          error: "Onboardinglink niet gevonden.",
        },
        { status: 404 }
      );
    }

    if (
      opdracht.token_verloopt_op &&
      new Date(opdracht.token_verloopt_op).getTime() < Date.now()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Deze onboardinglink is verlopen.",
        },
        { status: 410 }
      );
    }

    await db.query(
      `
      INSERT INTO gelezen_instructies (email, instructie_id, gelezen_op)
      VALUES ($1, $2, NOW())
      ON CONFLICT (email, instructie_id)
      DO UPDATE SET gelezen_op = COALESCE(gelezen_instructies.gelezen_op, NOW())
      `,
      [
        String(opdracht.medewerker_email).toLowerCase(),
        opdracht.instructie_id,
      ]
    );

    await db.query(
      `
      UPDATE onboarding_opdrachten
      SET
        status = 'afgerond',
        afgerond_op = COALESCE(afgerond_op, NOW()),
        bijgewerkt_op = NOW()
      WHERE id = $1
      `,
      [opdracht.id]
    );

    return NextResponse.json({
      success: true,
      afgerond: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Onboarding kon niet worden afgerond: ${String(error)}`,
      },
      { status: 500 }
    );
  }
}