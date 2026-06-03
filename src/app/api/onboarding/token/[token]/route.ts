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

async function haalVragen(instructieId: string) {
  const vragenResult = await db.query(
    `
    SELECT
      id,
      instructie_id,
      vraag,
      uitleg,
      type,
      verplicht,
      sortering
    FROM instructie_vragen
    WHERE instructie_id = $1
      AND actief = true
    ORDER BY sortering ASC, aangemaakt_op ASC
    `,
    [instructieId]
  );

  const vragen = vragenResult.rows;

  if (vragen.length === 0) {
    return [];
  }

  const vraagIds = vragen.map((vraag) => vraag.id);

  const optiesResult = await db.query(
    `
    SELECT
      id,
      vraag_id,
      tekst,
      sortering
    FROM instructie_vraag_opties
    WHERE vraag_id = ANY($1::uuid[])
    ORDER BY sortering ASC, aangemaakt_op ASC
    `,
    [vraagIds]
  );

  const optiesPerVraag = new Map<string, any[]>();

  for (const optie of optiesResult.rows) {
    const vraagId = String(optie.vraag_id);

    if (!optiesPerVraag.has(vraagId)) {
      optiesPerVraag.set(vraagId, []);
    }

    optiesPerVraag.get(vraagId)!.push({
      id: optie.id,
      tekst: optie.tekst,
      sortering: optie.sortering,
    });
  }

  return vragen.map((vraag) => ({
    id: vraag.id,
    instructie_id: vraag.instructie_id,
    vraag: vraag.vraag,
    uitleg: vraag.uitleg,
    type: vraag.type,
    verplicht: vraag.verplicht,
    sortering: vraag.sortering,
    opties: optiesPerVraag.get(String(vraag.id)) || [],
  }));
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

    const vragen = await haalVragen(opdracht.instructie_id);

    return NextResponse.json({
      success: true,
      opdracht,
      vragen,
      heeftVragen: vragen.length > 0,
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