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

type AntwoordInput = {
  vraagId: string;
  optieId: string;
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

function isTokenVerlopen(opdracht: any) {
  return (
    opdracht.token_verloopt_op &&
    new Date(opdracht.token_verloopt_op).getTime() < Date.now()
  );
}

async function haalVragenVoorWeergave(instructieId: string) {
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

async function haalVragenVoorControle(instructieId: string) {
  const vragenResult = await db.query(
    `
    SELECT
      id,
      vraag,
      verplicht
    FROM instructie_vragen
    WHERE instructie_id = $1
      AND actief = true
      AND type = 'multiple_choice'
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
      is_correct
    FROM instructie_vraag_opties
    WHERE vraag_id = ANY($1::uuid[])
    `,
    [vraagIds]
  );

  const optiesPerVraag = new Map<string, any[]>();

  for (const optie of optiesResult.rows) {
    const vraagId = String(optie.vraag_id);

    if (!optiesPerVraag.has(vraagId)) {
      optiesPerVraag.set(vraagId, []);
    }

    optiesPerVraag.get(vraagId)!.push(optie);
  }

  return vragen.map((vraag) => ({
    ...vraag,
    opties: optiesPerVraag.get(String(vraag.id)) || [],
  }));
}

async function markeerAfgerond(opdracht: any) {
  await db.query(
    `
    INSERT INTO gelezen_instructies (email, instructie_id, gelezen_op)
    VALUES ($1, $2, NOW())
    ON CONFLICT (email, instructie_id)
    DO UPDATE SET gelezen_op = COALESCE(gelezen_instructies.gelezen_op, NOW())
    `,
    [String(opdracht.medewerker_email).toLowerCase(), opdracht.instructie_id]
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

    if (isTokenVerlopen(opdracht)) {
      return NextResponse.json(
        {
          success: false,
          error: "Deze onboardinglink is verlopen.",
        },
        { status: 410 }
      );
    }

    const vragen = await haalVragenVoorWeergave(opdracht.instructie_id);

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

export async function POST(req: NextRequest, { params }: Params) {
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

    if (isTokenVerlopen(opdracht)) {
      return NextResponse.json(
        {
          success: false,
          error: "Deze onboardinglink is verlopen.",
        },
        { status: 410 }
      );
    }

    if (opdracht.status === "afgerond") {
      return NextResponse.json({
        success: true,
        afgerond: true,
        alAfgerond: true,
        melding: "Deze instructie was al afgerond.",
      });
    }

    const vragen = await haalVragenVoorControle(opdracht.instructie_id);

    // Geen vragen: alleen bevestigen dat de instructie gelezen en begrepen is.
    if (vragen.length === 0) {
      await markeerAfgerond(opdracht);

      return NextResponse.json({
        success: true,
        afgerond: true,
        geslaagd: true,
        aantalVragen: 0,
        aantalCorrect: 0,
      });
    }

    const body = await req.json().catch(() => ({}));

    const antwoorden: AntwoordInput[] = Array.isArray(body?.antwoorden)
      ? body.antwoorden.map((antwoord: any) => ({
          vraagId: String(antwoord?.vraagId || "").trim(),
          optieId: String(antwoord?.optieId || "").trim(),
        }))
      : [];

    const antwoordPerVraag = new Map<string, string>();

    for (const antwoord of antwoorden) {
      if (antwoord.vraagId && antwoord.optieId) {
        antwoordPerVraag.set(antwoord.vraagId, antwoord.optieId);
      }
    }

    const verplichteVragen = vragen.filter((vraag) => vraag.verplicht);

    const ontbrekendeVragen = verplichteVragen.filter(
      (vraag) => !antwoordPerVraag.has(String(vraag.id))
    );

    if (ontbrekendeVragen.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Niet alle verplichte vragen zijn beantwoord.",
          ontbrekendeVragen: ontbrekendeVragen.map((vraag) => vraag.id),
        },
        { status: 400 }
      );
    }

    let aantalCorrect = 0;

    const teControlerenVragen = vragen.filter((vraag) => {
      const vraagId = String(vraag.id);
      return vraag.verplicht || antwoordPerVraag.has(vraagId);
    });

    const controleResultaten = teControlerenVragen.map((vraag) => {
      const gekozenOptieId = antwoordPerVraag.get(String(vraag.id)) || null;

      const gekozenOptie = vraag.opties.find(
        (optie: any) => String(optie.id) === String(gekozenOptieId)
      );

      const correct = Boolean(gekozenOptie?.is_correct);

      if (correct) {
        aantalCorrect += 1;
      }

      return {
        vraagId: String(vraag.id),
        gekozenOptieId,
        correct,
      };
    });

    const aantalVragen = teControlerenVragen.length;
    const geslaagd = aantalVragen === 0 || aantalCorrect === aantalVragen;

    const resultaatInsert = await db.query(
      `
      INSERT INTO instructie_toets_resultaten (
        onboarding_opdracht_id,
        medewerker_email,
        instructie_id,
        afgerond_op,
        aantal_vragen,
        aantal_correct,
        geslaagd
      )
      VALUES ($1, $2, $3, NOW(), $4, $5, $6)
      RETURNING id
      `,
      [
        opdracht.id,
        String(opdracht.medewerker_email).toLowerCase(),
        opdracht.instructie_id,
        aantalVragen,
        aantalCorrect,
        geslaagd,
      ]
    );

    const resultaatId = resultaatInsert.rows[0].id;

    for (const resultaat of controleResultaten) {
      await db.query(
        `
        INSERT INTO instructie_toets_antwoorden (
          resultaat_id,
          vraag_id,
          gekozen_optie_id,
          correct
        )
        VALUES ($1, $2, $3, $4)
        `,
        [
          resultaatId,
          resultaat.vraagId,
          resultaat.gekozenOptieId,
          resultaat.correct,
        ]
      );
    }

    if (geslaagd) {
      await markeerAfgerond(opdracht);
    }

    return NextResponse.json({
      success: true,
      afgerond: geslaagd,
      geslaagd,
      aantalVragen,
      aantalCorrect,
      fouten: controleResultaten
        .filter((resultaat) => !resultaat.correct)
        .map((resultaat) => resultaat.vraagId),
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